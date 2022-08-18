'use strict';

var url = require('url');

var IntentReport = require('../service/IntentReportService');

module.exports.deleteIntentReport = function deleteIntentReport (req, res, next) {
  IntentReport.deleteIntentReport(req, res, next);
};

module.exports.listIntentReport = function listIntentReport (req, res, next) {
  IntentReport.listIntentReport(req, res, next);
};

module.exports.retrieveIntentReport = function retrieveIntentReport (req, res, next) {
  IntentReport.retrieveIntentReport(req, res, next);
};
