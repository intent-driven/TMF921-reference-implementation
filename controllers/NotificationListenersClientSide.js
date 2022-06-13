'use strict';

var url = require('url');

var NotificationListenersClientSide = require('../service/NotificationListenersClientSideService');

module.exports.listenToIntentChangeEvent = function listenToIntentChangeEvent (req, res, next) {
  NotificationListenersClientSide.listenToIntentChangeEvent(req, res, next);
};

module.exports.listenToIntentCreateEvent = function listenToIntentCreateEvent (req, res, next) {
  NotificationListenersClientSide.listenToIntentCreateEvent(req, res, next);
};

module.exports.listenToIntentDeleteEvent = function listenToIntentDeleteEvent (req, res, next) {
  NotificationListenersClientSide.listenToIntentDeleteEvent(req, res, next);
};

module.exports.listenToIntentReportChangeEvent = function listenToIntentReportChangeEvent (req, res, next) {
  NotificationListenersClientSide.listenToIntentReportChangeEvent(req, res, next);
};

module.exports.listenToIntentReportCreateEvent = function listenToIntentReportCreateEvent (req, res, next) {
  NotificationListenersClientSide.listenToIntentReportCreateEvent(req, res, next);
};

module.exports.listenToIntentReportDeleteEvent = function listenToIntentReportDeleteEvent (req, res, next) {
  NotificationListenersClientSide.listenToIntentReportDeleteEvent(req, res, next);
};
