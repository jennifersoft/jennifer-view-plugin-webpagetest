var aries_profiler = {
    origin: "global.app6",
    depth: 2,
    limit: 10000,
    minimum: 0,
    data: []
};

(function(global, startPoint, maxDepth, maxCount, minResponseTime) {
    if(typeof(global.Proxy) != "function") return;

    var PROFILES = [];
    var PROFILES_COUNT = {};
    var ACTIVE_QUEUE = [];

    var EXCEPT_FUNCTIONS = [
        "requestAnimationFrame",
        "getComputedStyle"
    ];

    var EXCEPT_OBJECTS = [
        "window",
        "opener",
        "top",
        "location",
        "document",
        "frames",
        "self",
        "parent",
        "jQuery"
    ];

    function convertObjectToString(obj) {
        var values = [];

        for(var key in obj) {
            if(typeof(obj[key]) == "object") {
                values.push(key + ":object");
            } else {
                if(typeof(obj[key]) == "function") {
                    values.push(key + ":function");
                } else {
                    values.push(key + ":" + obj[key]);
                }
            }
        }

        return "{" + values.join(",") + "}";
    }

    function createProxy(parent, name, obj, callerObj) {
        if(PROFILES_COUNT[name] == undefined) {
            PROFILES_COUNT[name] = 0;
        }

        var getProxyParameters = function(args, queue) {
            var parameterList = [];

            for(var i = 0; i < args.length; i++) {
                if(typeof(args[i]) == "function") {
                    parameterList[i] = {
                        type: "function",
                        value: "callback"
                    };

                    var callbackProxy = createProxy(parent, "__callback__", args[i], {
                        name: queue.name,
                        depth: queue.depth - 1,
                        count: queue.count
                    });

                    args[i] = callbackProxy;
                } else if(typeof(args[i]) == "object") {
                    // TODO: 차후 다시 구현하기 (value를 문자열로 만드는것)
                    parameterList[i] = {
                        type: "object",
                        value: convertObjectToString(args[i])
                    };
                } else {
                    parameterList[i] = {
                        type: "primitive",
                        value: args[i]
                    };
                }
            }

            return parameterList;
        }

        var proxyApply = function(target, that, args) {
            if(PROFILES.length < maxCount) {
                ACTIVE_QUEUE.push({
                    name: name,
                    depth: ACTIVE_QUEUE.length + 1,
                    count: PROFILES_COUNT[name]
                });

                var parameterList = getProxyParameters(args, ACTIVE_QUEUE[ACTIVE_QUEUE.length - 1]);
                var startTime = Date.now();
                var callerQueue = ACTIVE_QUEUE[ACTIVE_QUEUE.length - 2];
                var callerName = (callerQueue != undefined) ? callerQueue.name : null;
                var callerDepth = (callerQueue != undefined) ? callerQueue.depth : 0;
                var realReturnValue = Reflect.apply(target, that, args);
                var returnValue = null;
                var responseTime = Date.now() - startTime;

                // TODO: target이랑 that까지 비교하면 비동기 호출 끝을 찾을 수 있을 것 같음???
                ACTIVE_QUEUE.pop();

                if(callerName == null) {
                    if(callerObj !== undefined) {
                        callerName = callerObj.name;
                        callerDepth = callerObj.depth;
                    } else {
                        callerName = "global";
                    }
                }

                // 응답값이 기본형이 아닐 경우에 대한 처리
                if(typeof(realReturnValue) == "function") {
                    returnValue = "function";
                } else if(typeof(realReturnValue) == "object") {
                    returnValue = convertObjectToString(returnValue);
                } else {
                    returnValue = realReturnValue;
                }

                if(responseTime >= minResponseTime) {
                    if(PROFILES_COUNT[callerName] == undefined) {
                        PROFILES_COUNT[callerName] = 0;
                    }

                    var functionName = name + "/" + PROFILES_COUNT[name];

                    if(callerObj !== undefined) {
                        callerName = callerName + "/" + callerObj.count;
                    } else {
                        callerName = callerName + "/" + PROFILES_COUNT[callerName];
                    }

                    if(functionName == callerName) {
                        callerName = getCallerName(proxyApply.caller, functionName, 0);
                    }

                    PROFILES.push({
                        startTime: startTime,
                        parentName: parent,
                        functionName: functionName,
                        callerName: callerName,
                        callerDepth: callerDepth,
                        responseTime: responseTime,
                        returnValue: returnValue,
                        parameterList: parameterList
                    });

                    PROFILES_COUNT[name] += 1;
                }

                return realReturnValue;
            }

            return Reflect.apply(target, that, args);
        };

        return new Proxy(obj, {
            apply: proxyApply
        });
    }

    // TODO: callerName을 몾찾을 때...
    function getCallerName(caller, functionName, searchDepth) {
        if(typeof(caller) == "object") {
            var maxSearchDepth = 10;
            var name = caller.name;
            var prevCount = PROFILES_COUNT[name];
            var prevName = name + "/" + prevCount;

            if (prevCount != undefined && prevName != functionName) {
                return prevName;
            }

            if (searchDepth < maxSearchDepth) {
                return getCallerName(caller.caller, functionName, searchDepth + 1);
            }
        }

        return "unknown/0";
    }

    function initializeProxies(origin, depth) {
        var root = eval(origin);

        for(var name in root) {
            var path = origin + "." + name;

            if(typeof(root[name]) == "function") {
                if(!EXCEPT_FUNCTIONS.includes(name)) {
                    root[name] = createProxy(origin, name, root[name]);
                }
            }

            if(typeof(root[name]) == "function" || typeof(root[name]) == "object") {
                var reg = /^[0-9]*$/;

                // TODO: object[string] 형태로 설정된 객체는 제외함. 차후 개선할 필요가 있음
                if(!reg.test(name) && name.indexOf(".") == -1 && depth < maxDepth) {
                    if(!EXCEPT_OBJECTS.includes(name)) {
                        initializeProxies(path, depth + 1);
                    }
                }
            }
        }
    }

    initializeProxies(startPoint, 0);

    aries_profiler.data = PROFILES;
}(window, aries_profiler.origin, aries_profiler.depth, aries_profiler.limit, aries_profiler.minimum));