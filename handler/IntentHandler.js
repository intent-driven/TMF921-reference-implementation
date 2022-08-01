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
const Intent = require('../controllers/Intent');

// This function is called from the RI once the intent as been stored in MOngo
//it will extract the expression from the request body, parse the expresion into
//triples and then store these triples in the graphdb.
//It then reads a hardcode intent report and send this back to the listeners 
//using the RI HUB
exports.processIntent = function(req) {

  //extract expression
  const expression = handlerUtils.getExpression(req);

  //From expression extract triples and load the data in GraphDB 
  handlerUtils.extractTriplesandKG(expression,`insert`,'text/turtle');
  
  //check type of intent...just search for B1, S1, R1&slice or R1&private
  var filename = handlerUtils.intentReportFileName(expression);
  

  //now we need to send the IntentReport
  //1. read report - async
  fs.readFile('./ontologies/'+filename, 'utf8', (err, data) => {
    if (err) {
      console.error(err);
      return;
    }
 //   console.log(data);
  //2. insert report in grapbdb
  handlerUtils.extractTriplesandKG(data,`insert`,'text/turtle');

 //3. insert report into mongodb and send notification
  handlerUtils.insertIntentReport(data,req);
  //4. create event
//  inside the previous step as async
});
};

// This function is called from the RI once the intent as been deleted from MOngo
//it reads the intent expression from mongo, parse the expresion into
//triples and then deletes these triples from the graphdb.
exports.deleteIntent = function(query,resourceType) {

   console.log('query: '+query)
   console.log('resourceType: '+resourceType)
  //reads intent from mongo and then deletes objects from KG.  All in one function as async
  handlerUtils.getIntentExpressionandDeleteKG(query,resourceType); 

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
