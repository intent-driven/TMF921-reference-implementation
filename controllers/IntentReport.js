'use strict';

var url = require('url');

var IntentReport = require('../service/IntentReportService');

module.exports.listIntentReport = function listIntentReport (req, res, next) {
  IntentReport.listIntentReport(req, res, next);
};

module.exports.retrieveIntentReport = function retrieveIntentReport (req, res, next) {
  IntentReport.retrieveIntentReport(req, res, next);
};
