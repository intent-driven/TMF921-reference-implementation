'use strict';

var url = require('url');

var Intent = require('../service/IntentService');

module.exports.createIntent = function createIntent (req, res, next) {
  Intent.createIntent(req, res, next);
};

module.exports.deleteIntent = function deleteIntent (req, res, next) {
  Intent.deleteIntent(req, res, next);
};

module.exports.listIntent = function listIntent (req, res, next) {
  Intent.listIntent(req, res, next);
};

module.exports.patchIntent = function patchIntent (req, res, next) {
  Intent.patchIntent(req, res, next);
};

module.exports.retrieveIntent = function retrieveIntent (req, res, next) {
  Intent.retrieveIntent(req, res, next);
};
