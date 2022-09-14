//////////////////////////////////////////////////////
/*              Huawei IRC                          */
/*              Idan Catalyst                       */
/* IntentHandler:                                   */
/* Intent Handler creates and deletes the Knowledge */
/* objects                                          */
//////////////////////////////////////////////////////
'use strict';

const util = require('util');
const uuid = require('uuid');
const fs = require('fs');
const async = require('async');
const $rdf = require('rdflib')

const notificationUtils = require('../utils/notificationUtils');


const {TError, TErrorEnum, sendError} = require('../utils/errorUtils');
const handlerUtils = require('../utils/handlerUtils');
const mongoUtils = require('../utils/mongoUtils');
const swaggerUtils = require('../utils/swaggerUtils');
const Intent = require('../controllers/Intent');

const serviceIntentHandler = require('../handler/ServiceIntentHandler');

// This function is called from the RI once the intent as been stored in MOngo
//it will extract the expression from the request body, parse the expresion into
//triples and then store these triples in the graphdb.
//It then reads a hardcode intent report and send this back to the listeners 
//using the RI HUB
exports.processIntent = function(req) {
//  handlerUtils.wait(120000);

  //extract expression
  const expression = handlerUtils.getExpression(req);

  //From expression extract triples and load the data in GraphDB 
  handlerUtils.extractTriplesandKG(expression,`insert`,'text/turtle');
  
  var filename;
//we return the following reports
// 1. Intent Accepted

  filename = 'R1R1_Intent_Accepted.ttl'
  handlerUtils.sendIntentReport('R1R1_Intent_Accepted',filename,req);
  console.log('log: R1 Report Accepted sent');

// 1. Intent Accepted
//handlerUtils.wait(60000);

filename = 'R1R2_Intent_Compliant.ttl'
handlerUtils.sendIntentReport('R1R2_Intent_Compliant',filename,req);
console.log('log: R1 Report Compliant sent');
};

exports.patchIntent = function(req) {

  //extract expression
  const expression = handlerUtils.getExpression(req);

  //From expression extract triples and load the data in GraphDB 
  handlerUtils.extractTriplesandKG(expression,`insert`,'text/turtle');
  
  var filename;
//we return the following reports
// 1. Intent Accepted
  var id = req.url.substring(26);
  req.body.id = id;

  filename = 'R1R4_Intent_Compliant.ttl'
  handlerUtils.sendIntentReport('R1R4_Intent_Compliant',filename,req);
  console.log('log: R1 patch Report Accepted sent');

};


// This function is called from the RI once the intent as been deleted from MOngo
//it reads the intent expression from mongo, parse the expresion into
//triples and then deletes these triples from the graphdb.
exports.deleteIntent = function(query,resourceType) {

  console.log('query.id: '+query.id)
  console.log('resourceType: '+resourceType)
 //reads intent from mongo and then deletes objects from KG.  All in one function as async
 handlerUtils.getIntentExpressionandDeleteKG(query,resourceType); 

};
exports.deleteIntentbyName = function(name,req,serviceIntent) {
  var query = mongoUtils.getMongoQuery(req);
  query.criteria.name = name
//  query = swaggerUtils.updateQueryServiceType(query, req,'name');
  var resourceType = 'Intent'
  console.log('name: '+name)
  console.log('resourceType: '+resourceType)
  mongoUtils.connect().then(db => {
  db.collection(resourceType)
  .find(query.criteria, query.options).toArray()
  .then(doc => {
    doc.forEach(x => {
      var query2 = {
        id: x.id
      };
      if (serviceIntent) {
         serviceIntentHandler.deleteIntentReports(x.id, 'IntentReport');
         serviceIntentHandler.deleteIntent(query2,'Intent');
      } else {
        this.deleteIntentReports(x.id, 'IntentReport');
        this.deleteIntent(query2,'Intent');
      }
    })
  })
  .catch(error => {
  console.log("deleteIntent: error=" + error);
  });
  })
  .catch(error => {
  console.log("deleteIntent: error=" + error);
  });

};

// This function is called from the RI once the intentReport as been deleted from MOngo
//it reads the intentReport expression from mongo, parse the expresion into
//triples and then deletes these triples from the graphdb.
exports.deleteIntentReports = function(id,resourceType) {

  console.log('intentid: '+id)
  console.log('resourceType: '+resourceType)
 //reads intent from mongo and then deletes objects from KG.  All in one function as async
 handlerUtils.getIntentReportExpressionandDeleteKG(id,resourceType); 


};
