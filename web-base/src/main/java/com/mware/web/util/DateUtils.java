package com.mware.web.util;

import java.text.SimpleDateFormat;
import java.util.Date;

public class DateUtils {

    public Date parseDateString(String dateString) {
        try {
            return new SimpleDateFormat("yyyy-MM-dd").parse(dateString);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid date format: " + dateString);
        }
    }

}
