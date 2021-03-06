var domainBox = null, pathCombo = null, timeTable = null,
    timeMax = 0, product = (typeof(aries) == "undefined") ? jennifer : aries;

jui.ready([ "ui.combo", "grid.xtable", "chart.builder" ], function(combo, xtable, builder) {
    $.ajax({
        url: "/domain/list",
        data: {
            format: "json"
        },
        async: false,
        success: function(data) {
            var $ul = $("#ext_domain").find("ul");

            for(var i = 0; i < data.length; i++) {
                $ul.append("<li value='" + data[i].sid + "'>" + data[i].shortName + "</li>")
            }
        }
    });

    var domainId = localStorage.getItem("extDomainId");
    domainBox = combo("#ext_domain", {
        width: 150,
        value: (domainId == null) ? "" : domainId,
        event: {
            change: function(data) {
                loadFrontendUrl(data.value);
                localStorage.setItem("extDomainId", data.value);
                $("#ext_path_tail").find("a").trigger("click");
            }
        }
    });

    timeTable = xtable("#ext_timeline", {
        fields: [ "name", "status", "type", "initiator", "size", "time", null ],
        resize: true,
        sort: [ 0, 1, 2, 3, 4, 5 ],
        width: $("#pagetest-main").width(),
        scrollWidth: $("#pagetest-main").width(),
        scrollHeight: $("#dashboardContentBody").height() - 300,
        event: {
            scroll: function() {
                updateInnerTimeCharts();
            }
        }
    });

    $("#ext_path_tail").find("a").on("click", function(e) {
        $("#ext_path_tail").hide();
        $("#ext_path").show();
    });

    $("#ext_host").on("keyup", function(e) {
        localStorage.setItem("extHostName", $(this).val());
    });

    $("#ext_test").on("click", function(e) {
        sessionStorage.setItem("extUrlTail", $("#ext_path_tail").find("input").val());
        location.reload();
    });

    $(window).on("message", function(e) {
        var d = e.originalEvent.data;

        loadEntryData(d.txid, d.entries);

        setTimeout(function() {
            $("#ext_top_section").show();
            loadSectionData(d.txid);
        }, 1000);
    });

    if(localStorage.hasOwnProperty("extHostName")) {
        $("#ext_host").val(localStorage.getItem("extHostName"));
    }

    if(sessionStorage.hasOwnProperty("extUrlTail")) {
        var url = sessionStorage.getItem("extUrlTail");

        if(url) {
            performance.clearResourceTimings();
            $("#ext_path_tail").find("input").val(url);

            var host = $("#ext_host").val();
            if (!host.startsWith("http")) {
                alert("Required host name!!!");
                return;
            }

            if (url.indexOf("*") != -1) {
                alert("Remove '*' symbol!!!");
                return;
            }

            $.ajax({
                url: host + url,
                dataType: "jsonp",
                timeout: 10000,
                success: function () {
                    product.ui.showLoading();
                    $("#ext_iframe").attr("src", host + url);
                },
                error: function (parsedjson) {
                    if(parsedjson.status == "200") {
                        product.ui.showLoading();
                        $("#ext_iframe").attr("src", host + url);
                    } else {
                        product.ui.closeLoading();

                        sessionStorage.removeItem("extUrlTail");
                        alert("404!!!");
                    }
                }
            });
        }
    }

    loadFrontendUrl(domainBox.getValue());
});

function loadFrontendUrl(sid) {
    $.ajax({
        url: "/frontEnd/monitorurl/get",
        data: {
            format: "json",
            sid: sid
        },
        success: function(data) {
            var $ul = $("#ext_path").find("ul").empty();

            $ul.append("<li value='none'>Direct input</li>");
            for(var i = 0; i < data.list.length; i++) {
                $ul.append("<li value='" + data.list[i].urlPattern + "'>" + data.list[i].urlPattern + "</li>");
            }

            pathCombo = jui.create("ui.combo", "#ext_path", {
                width: 300,
                value: $("#ext_path_tail").find("input").val(),
                event: {
                    change: function(data) {
                        if(data.text.indexOf("*") != -1 || data.text == "Direct input") {
                            $("#ext_path_tail").show();
                            $("#ext_path").hide();
                        } else {
                            $("#ext_path_tail").hide();
                            $("#ext_path").show();
                        }

                        $("#ext_path_tail").find("input").val(data.text == "Direct input" ? "" : data.text);
                    }
                }
            });
        }
    });
}

function loadEntryData(txid, entryStr) {
    $.ajax({
        url: "/plugin/webpagetest/list",
        method: "POST",
        data: {
            entryStr: entryStr,
            txid: txid
        },
        success: function(data) {
            for(var i = 0; i < data.length; i++) {
                timeMax = Math.max(timeMax, data[i].duration)
            }

            timeTable.update(data);
            updateInnerTimeCharts();
        },
        error: function(e) {
        }
    });
}

function loadSectionData(txid) {
    $("#ext_section").empty();

    var time = getServerMoment().valueOf();

    var params = {
        txid: txid,
        xtype: 1,
        type: 0,
        format: "json",
        sid: domainBox.getValue(),
        stime: time - 1000 * 60,
        etime: time + 1000 * 60
    };

    $.ajax({
        url: "/xview/profile/serverTimeComponent",
        method: "GET",
        data: params,
        success: function(server) {
            $.ajax({
                url: "/xview/profile/clientTimeComponent",
                method: "GET",
                data: params,
                success: function(client) {
                    var total = client.domTime + client.renderTime + client.networkTime +
                        server.methodTotalTime + server.sqlTotalTime + server.txTotalTime;

                    jui.create("chart.builder", "#ext_section", {
                        height : 70,
                        padding : {
                            left: 0,
                            right: 0,
                            top: 20,
                            bottom: 0
                        },
                        axis : [{
                            x : {
                                type : "range",
                                domain : [ 0, 100 ],
                                hide : true,
                                orient: "top"
                            },
                            y : {
                                type : "block",
                                domain : [ "" ],
                                hide : true
                            },
                            data : [{
                                excall: server.txTotalTime,
                                sql: server.sqlTotalTime,
                                method: server.methodTotalTime,
                                network: client.networkTime,
                                render: client.renderTime,
                                dom: client.domTime
                            }]
                        }],
                        brush : [{
                            type : "fullstackbar",
                            target : [ "excall", "sql", "method", "network", "render", "dom" ],
                            showText : true,
                            outerPadding : 0,
                            innerPadding : 0,
                            colors : [
                                "rgb(59, 192, 153)",
                                "rgb(106, 175, 232)",
                                "#96D7EB",
                                "rgb(246, 181, 1)",
                                "rgb(111, 8, 206)",
                                "rgb(120, 120, 194)"
                            ]
                        }],
                        widget : [{
                            type : "tooltip",
                            orient : "top",
                            format : function(data, key) {
                                return {
                                    key: key,
                                    value: data[key] + "ms"
                                }
                            }
                        }],
                        style : {
                            gridXAxisBorderWidth : 0,
                            gridYAxisBorderWidth : 0,
                            gridZAxisBorderWidth : 0,
                            gridBorderWidth : 0,
                            gridTickBorderSize : 0,
                            barFontColor : "#fff",
                            barFontSize : 12,
                            tooltipBorderColor : "#000"
                        }
                    });

                    product.ui.closeLoading();
                }
            })
        }
    });
}

function updateInnerTimeCharts() {
    $("#ext_timeline").find(".inner-chart").each(function() {
        (function($row) {
            if($row.html() == "") {
                setTimeout(function () {
                    createTimelineRow($row.data("index"));
                }, 500);
            }
        })($(this))
    });
}

function createTimelineRow(index) {
    var data = timeTable.get(index).data,
        target = [ "startTime", "frontend", "serverend" ],
        colors = [ "transparent", "#2282d1", "#3bc099" ];

    if(data.type == "resource") {
        data.redirect = (data.redirectEnd == 0) ? 0.0 : data.redirectEnd - data.redirectStart;
        data.dns = (data.domainLookupEnd == 0) ? 0.0 : data.domainLookupEnd - data.domainLookupStart;
        data.tcp = (data.connectEnd == 0) ? 0.0 : data.connectEnd - data.connectStart;
        data.request = (data.responseStart == 0) ? 0.0 : data.responseStart - data.requestStart;
        data.response = (data.responseEnd == 0) ? 0.0 : data.responseEnd - data.responseStart;

        var total = data.redirect + data.dns + data.tcp + data.request + data.response;
        data.queue = (data.duration > total) ? data.duration - total : 0.0;

        target = [ "startTime", "queue", "redirect", "dns", "tcp", "request", "response" ];
        colors = [ "transparent", "#a9a9a9", "#12f2e8", "#26f67c", "#e9f819", "#b78bf9", "#f94590" ]
    } else {
        data.serverend = data.responseEnd;
        data.frontend = data.duration - data.serverend;
    }

    return jui.create("chart.builder", "#table_chart_" + index, {
        height : 10,
        padding : {
            top : 3,
            bottom : 3,
            left : 0,
            right : 0
        },
        axis : [{
            x : {
                type : "range",
                domain : [ 0, timeMax ],
                line : true,
                orient: "top"
            },
            y : {
                type : "block",
                domain : [ "" ],
                line : true
            },
            data : [ data ]
        }],
        brush : [{
            type : "stackbar",
            target : target,
            outerPadding : 0,
            innerPadding : 0,
            colors : colors
        }],
        event : {
            mouseover: function(obj, e) {
                $("#ext_tooltip_redirect").html(obj.data.redirect.toFixed(2));
                $("#ext_tooltip_dns").html(obj.data.dns.toFixed(2));
                $("#ext_tooltip_tcp").html(obj.data.tcp.toFixed(2));
                $("#ext_tooltip_request").html(obj.data.request.toFixed(2));
                $("#ext_tooltip_response").html(obj.data.response.toFixed(2));

                $("#ext_tooltip").css({
                    left: e.x - 240,
                    top: e.y - 200
                }).show();
            },
            mouseout: function(obj, e) {
                $("#ext_tooltip").hide();
            }
        },
        style : {
            gridXAxisBorderWidth : 0,
            gridYAxisBorderWidth : 0,
            gridZAxisBorderWidth : 0,
            gridBorderWidth : 0,
            gridTickBorderSize : 0
        }
    });
}

function showExtXViewPopup(txid) {
    var time = getServerMoment().valueOf();

    product.ui.getXivewPointList(
        domainBox.getValue(),
        [ txid ],
        time - 1000 * 60,
        time + 1000 * 60
    );
}