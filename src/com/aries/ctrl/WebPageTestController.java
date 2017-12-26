package com.aries.ctrl;

import com.aries.view.extension.util.LogUtil;
import org.apache.commons.io.IOUtils;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ModelMap;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.ModelAndView;

import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.*;

@Controller
@RequestMapping(value = { "/plugin" })
public class WebPageTestController {
    @RequestMapping(value = { "/webpagetest" }, method = RequestMethod.GET)
    public ModelAndView mainPage(WebRequest request)
    {
        ModelAndView modelAndView = new ModelAndView();
        ModelMap map = modelAndView.getModelMap();

        return modelAndView;
    }

    @RequestMapping(value = { "/webpagetest/list" }, method = RequestMethod.POST)
    @ResponseBody
    public List<Map<String, Object>> getEntries(@RequestParam String entryStr, @RequestParam String txid) throws JSONException {
        List<Map<String, Object>> result = new ArrayList<Map<String, Object>>();
        LogUtil.info("txid : " + txid);

        JSONArray jsonArray = new JSONArray(entryStr);
        for (int i = 0; i < jsonArray.length(); i++) {
            JSONObject row = jsonArray.getJSONObject(i);

            Map<String, Object> map = new HashMap<String, Object>();
            String url = (String) row.get("name");
            String[] urls = url.split("/");

            try {
                URL urlObj = new URL(url);
                HttpURLConnection connection = (HttpURLConnection)urlObj.openConnection();
                connection.setRequestMethod("HEAD");
                InputStream input = connection.getInputStream();
//            connection.connect();
                map.put("status", connection.getResponseCode());
                map.put("size", connection.getContentLength());
            } catch(IOException e) {
                map.put("status", 500);
                map.put("size", 0);
            }

            map.put("url", url);
            map.put("name", urls[urls.length - 1]);
            map.put("type", row.get("entryType"));
            map.put("initiator", row.get("initiatorType"));
            map.put("duration", row.get("duration"));

            map.put("decodedBodySize", row.get("decodedBodySize"));
            map.put("encodedBodySize", row.get("encodedBodySize"));
            map.put("transferSize", row.get("transferSize"));

            map.put("redirectStart", row.get("redirectStart"));
            map.put("redirectEnd", row.get("redirectEnd"));
            map.put("domainLookupStart", row.get("domainLookupStart"));
            map.put("domainLookupEnd", row.get("domainLookupEnd"));
            map.put("connectStart", row.get("connectStart"));
            map.put("connectEnd", row.get("connectEnd"));
            map.put("secureConnectionStart", row.get("secureConnectionStart"));
            map.put("requestStart", row.get("requestStart"));
            map.put("responseStart", row.get("responseStart"));
            map.put("responseEnd", row.get("responseEnd"));

//            if(connection.getContentType().equals("application/javascript") || connection.getContentType().equals("text/css")) {
//                map.put("content", IOUtils.toString(input, "UTF-8"));
//            } else {
//                map.put("content", "");
//            }

            if(i == 0) {
                map.put("txid", txid);
            }

            // start time
            double stime = 0.0;
            if(row.has("startTime")) {
                stime = Double.parseDouble("" + row.get("startTime"));
            }
            map.put("startTime", stime);

            result.add(map);
        }

        Collections.sort(result, new Comparator<Map<String, Object>>() {
            @Override
            public int compare(Map<String, Object> arg0, Map<String, Object> arg1) {
                double stime0 = (Double) arg0.get("startTime");
                double stime1 = (Double) arg1.get("startTime");

                return stime0 < stime1 ? -1 : stime0 > stime1 ? 1:0;
            }
        });

        return result;
    }
}