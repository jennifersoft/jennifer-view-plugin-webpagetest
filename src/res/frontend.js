(function(ARIES_FEM) {

    if (!ARIES_FEM) {
        var aries_profiler = {
            origin: "global",
            depth: 2,
            limit: 5000,
            minimum: 0,
            data: []
        };

        (function(global, startPoint, maxDepth, maxCount, minResponseTime) {
            if(typeof(global.Proxy) != "function") return;

            var PROFILES = [];
            var PROFILES_COUNT = {
                GLOBAL: 0,
                UNKNOWN: 0
            };

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
                "parent"
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

            function createProxy(parent, name, obj) {
                if(typeof(PROFILES_COUNT[name]) == "undefined") {
                    PROFILES_COUNT[name] = 0;
                }

                var proxyApply = function(target, that, args) {
                    if(PROFILES.length < maxCount) {
                        var parameterList = [];

                        for(var i = 0; i < args.length; i++) {
                            if(typeof(args[i]) == "function") {
                                parameterList[i] = {
                                    type: "function",
                                    value: "callback"
                                };

                                var callbackProxy = createProxy(parent, name + "#" + i, args[i]);
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

                        var startTime = Date.now();
                        var callerName = (proxyApply.caller != null) ? proxyApply.caller.name : null;
                        var realReturnValue = Reflect.apply(target, that, args);
                        var returnValue = null;
                        var responseTime = Date.now() - startTime;

                        if(callerName == null) {
                            // 콜백함수인데, 콜러가 없다면 자신을 호출한 함수를 콜러로 설정한다.
                            if(name.indexOf("#") != -1) {
                                callerName = name.split("#")[0];
                                // 루트에 추가한다.
                            } else {
                                callerName = "GLOBAL";
                            }
                        }

                        // 공백일 때, 출처를 알 수 없음.
                        if(callerName === "") {
                            callerName = "UNKNOWN";
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
                            PROFILES.push({
                                startTime: startTime,
                                parentName: parent,
                                functionName: name + "/" + PROFILES_COUNT[name],
                                callerName: callerName + "/" + PROFILES_COUNT[callerName],
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

            function initializeProxies(origin, depth) {
                var root = eval(origin);

                for(var name in root) {
                    var path = origin + "." + name;

                    if(typeof(root[name]) == "function") {
                        if(!EXCEPT_FUNCTIONS.includes(name)) {
                            root[name] = createProxy(origin, name, root[name]);
                        }
                    } else if(typeof(root[name]) == "object") {
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

        function _j_fem_docComplete() {
            window.setTimeout(function () {
                try {
                    if (!!window.performance) {
                        var txid = "{{{aries_txid}}}";
                        var urlPrefix = "{{{aries_front_end_url_prefix}}}";

                        var timing = window.performance.timing;
                        var docCompleteTime = timing.domComplete;
                        var dnsLookup = timing.domainLookupEnd - timing.domainLookupStart;
                        var reqTime = timing.responseStart - timing.connectStart;
                        var respTime = timing.responseEnd - timing.responseStart;
                        var domTime = timing.domContentLoadedEventEnd - timing.domLoading;
                        var renderTime = docCompleteTime - timing.domContentLoadedEventEnd;

                        _j_docTimeContainedUrl = urlPrefix + "txid=" + txid + "&dom="
                            + domTime + "&render=" + renderTime + "&dns=" + dnsLookup
                            + "&req=" + reqTime + "&resp=" + respTime;

                        if(!_j_measureDataSent) {
                            _j_sendMeasureData();
                            _j_sendEntryData(txid);
                            _j_measureDataSent = true;
                        }
                    }
                } catch (e) {
                    console.log("AGENT : Cannot extract data, " + e);
                }
            }, 0);
        }

        function _j_sendMeasureData() {
            try {
                var url = _j_docTimeContainedUrl + "&ajaxCount=" + _j_nextAjaxCallIndex;
                var axObj = new XMLHttpRequest();

                axObj.open("GET", url, true);
                axObj.setRequestHeader("{{{aries_flag_header_key}}}", "true");
                axObj.send();
            } catch (e) {
                throw e;
                console.log("AGENT : Cannot send measure data, " + e);
            }
        }

        function _j_sendEntryData(txid) {
            try {
                if(window.self !== window.top) {
                    if (typeof(window.parent.postMessage) != "function") return;
                    if (typeof(window.performance.getEntries) != "function") return;

                    var entriesStr = "[]";
                    var profilesStr = "[]";

                    if (!!window.JSON) {
                        entriesStr = window.JSON.stringify(window.performance.getEntries());
                        profilesStr = window.JSON.stringify(aries_profiler.data)
                    }

                    setTimeout(function() {
                        window.parent.postMessage({
                            profiles: profilesStr,
                            entries: entriesStr,
                            txid: txid
                        }, "{{{aries_front_end_measure_origin_sender}}}");
                    }, 10000);
                }
            } catch (e) {
                throw e;
                console.log("AGENT : Cannot send entry data, " + e);
            }
        }

        try {
            if (window.addEventListener)
                window.addEventListener("load", _j_fem_docComplete, false);
            else if (window.attachEvent)
                window.attachEvent("onload", _j_fem_docComplete);
            else
                console.log("AGENT : Cannot add listener");
        } catch (e) {
            console.log("AGENT : Cannot add listener, " + e);
        }

        var _j_docTimeContainedUrl;
        var _j_nextAjaxCallIndex = 0;
        var _j_measureDataSent = false;

        window.ARIES_FEM = true;

    }

})(window.ARIES_FEM);