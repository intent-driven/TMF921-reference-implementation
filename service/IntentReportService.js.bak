'use strict';

//Minimal Service with filtering (equality match only) and attribute selection
//Error Handing Need to define a global error hqndler
//Paging and Range based Iterator to be added
//Notification to be added add listener and implement hub

const util = require('util');
const uuid = require('uuid');

const mongoUtils = require('../utils/mongoUtils');
const swaggerUtils = require('../utils/swaggerUtils');
const notificationUtils = require('../utils/notificationUtils');

const {sendDoc} = require('../utils/mongoUtils');

const {setBaseProperties, traverse, 
       addHref, processCommonAttributes } = require('../utils/operationsUtils');

const {validateRequest} = require('../utils/ruleUtils');

const {processAssignmentRules} = require('../utils/operations');

const {getPayloadType, getPayloadSchema, getResponseType} = require('../utils/swaggerUtils');

const {updateQueryServiceType, updatePayloadServiceType, cleanPayloadServiceType} = require('../utils/swaggerUtils');

const {TError, TErrorEnum, sendError} = require('../utils/errorUtils');

const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

exports.listIntentReport = function(req, res, next) {
  /**
   * List or find IntentReport objects
   * This operation list or find IntentReport entities
   *
   * intentId String Identifier of the parent Intent entity
   * fields String Comma-separated properties to be provided in response (optional)
   * offset Integer Requested index for start of resources to be provided in response (optional)
   * limit Integer Requested number of resources to be provided in response (optional)
   * returns List
   **/

  console.log('listIntentReport :: ' + req.method + ' ' + req.url + ' ' + req.headers.host);

  /* matching isRestfulIndex */
 
  var query = mongoUtils.getMongoQuery(req);

  query = swaggerUtils.updateQueryServiceType(query, req,'intentId');

  const resourceType = getResponseType(req);
  /* XXXXXXXXXXXXX Huawei IRC - Start  XXXXXXXXXXXXXXXx*/
  //The RI is not filtering intent report correctly using the intent ui
  var intentId = {
    'intent.id':req.swagger.params.intentId.value
  }

  query.criteria=intentId;
  /* XXXXXXXXXXXXX Huawei IRC - End  XXXXXXXXXXXXXXXx*/

  const internalError =  new TError(TErrorEnum.INTERNAL_SERVER_ERROR, "Internal database error");
  
  const generateQueryString = function(query,offset,limit) {
    var res='';
    var first=true;
    if(query.options.projection) {
      const fields=Object.keys(query.options.projection);
      res = res + '?fields=' + fields.join(',');
      first=false;
    }
    
    const delim = first ? '?' : '&';
    res = res + delim + "offset="+offset;
  
    if(query.options.limit) {
      const delim = first ? '?' : '&';
      res = res + delim + "limit="+limit;
    }

    return res;
  }

  const generateLink = function(query,skip,limit,type) {
    const basePath = req.url.replace(/\?.*$/,"");
    const hostPath = swaggerUtils.getURLScheme() + "://" + req.headers.host + basePath;
    return '"<' + hostPath + generateQueryString(query,skip,limit) + '>; rel="' + type + '"';
  }

  const setLinks = function(res,query,skip,limit,totalSize) {
    const links = [];
    links.push(generateLink(query,skip,limit,"self"));
    if(limit) {
      if(skip+limit<totalSize) {
        if(skip+2*limit<totalSize) {
          links.push(generateLink(query,skip+limit,limit,"next"));
        } else {
          links.push(generateLink(query,skip+limit,totalSize-skip-limit,"next"));
        }
        links.push(generateLink(query,totalSize-limit,limit,"last"));
      } 
      if(skip-limit>0) {
        links.push(generateLink(query,skip-limit,limit,"prev"));
      } else if(skip>0) {
        links.push(generateLink(query,0,skip,"prev"));
      }
    }
    res.setHeader('Link',links.join(', '));
  }

  // Find some documents based on criteria plus attribute selection
  mongoUtils.connect()
  .then(db => {
    db.collection(resourceType).stats()
    .then(stats => {
      const totalSize=stats.count;
      db.collection(resourceType)
      .find(query.criteria, query.options).toArray()
      .then(doc => {
        doc = cleanPayloadServiceType(doc);
        res.setHeader('X-Total-Count',totalSize);
        res.setHeader('X-Result-Count',doc.length);
        var skip = query.options.skip!==undefined ? parseInt(query.options.skip) : 0;
        var limit;
        if(query.options.limit!==undefined) limit = parseInt(query.options.limit);        
        if(limit || skip>0) setLinks(res,query,skip,limit,totalSize);

        var code = 200;
        if(limit && doc.length<totalSize) code=206;
        sendDoc(res, code, doc);
      })
      .catch(error => {
        console.log("listIntentReport: error=" + error);
        sendError(res, internalError);
      })
    })
    .catch(error => {
      console.log("listIntentReport: error=" + error);
      sendError(res, internalError);
    })
  })
  .catch(error => {
    console.log("listIntentReport: error=" + error);
    sendError(res, internalError);
  })



};

exports.retrieveIntentReport = function(req, res, next) {
  /**
   * Retrieves a IntentReport by ID
   * This operation retrieves a IntentReport entity. Attribute selection is enabled for all first level attributes.
   *
   * intentId String Identifier of the parent Intent entity
   * id String Identifier of the IntentReport
   * fields String Comma-separated properties to provide in response (optional)
   * returns IntentReport
   **/

  console.log('retrieveIntentReport :: ' + req.method + ' ' + req.url + ' ' + req.headers.host);

  /* matching isRestfulIndex */
 
  var query = mongoUtils.getMongoQuery(req);

  query = swaggerUtils.updateQueryServiceType(query, req,'id');

   /* XXXXXXXXXXXXX Huawei IRC - Start  XXXXXXXXXXXXXXXx*/
  //The RI is not filtering intent report correctly using the intent report ui
  query.criteria.id=req.swagger.params.id.value;
 /* XXXXXXXXXXXXX Huawei IRC - end  XXXXXXXXXXXXXXXx*/
  
  const resourceType = getResponseType(req);

  const internalError =  new TError(TErrorEnum.INTERNAL_SERVER_ERROR, "Internal database error");
  
  const generateQueryString = function(query,offset,limit) {
    var res='';
    var first=true;
    if(query.options.projection) {
      const fields=Object.keys(query.options.projection);
      res = res + '?fields=' + fields.join(',');
      first=false;
    }
    
    const delim = first ? '?' : '&';
    res = res + delim + "offset="+offset;
  
    if(query.options.limit) {
      const delim = first ? '?' : '&';
      res = res + delim + "limit="+limit;
    }

    return res;
  }

  const generateLink = function(query,skip,limit,type) {
    const basePath = req.url.replace(/\?.*$/,"");
    const hostPath = swaggerUtils.getURLScheme() + "://" + req.headers.host + basePath;
    return '"<' + hostPath + generateQueryString(query,skip,limit) + '>; rel="' + type + '"';
  }

  const setLinks = function(res,query,skip,limit,totalSize) {
    const links = [];
    links.push(generateLink(query,skip,limit,"self"));
    if(limit) {
      if(skip+limit<totalSize) {
        if(skip+2*limit<totalSize) {
          links.push(generateLink(query,skip+limit,limit,"next"));
        } else {
          links.push(generateLink(query,skip+limit,totalSize-skip-limit,"next"));
        }
        links.push(generateLink(query,totalSize-limit,limit,"last"));
      } 
      if(skip-limit>0) {
        links.push(generateLink(query,skip-limit,limit,"prev"));
      } else if(skip>0) {
        links.push(generateLink(query,0,skip,"prev"));
      }
    }
    res.setHeader('Link',links.join(', '));
  }

  // Find some documents based on criteria plus attribute selection
  mongoUtils.connect()
  .then(db => {
    db.collection(resourceType).stats()
    .then(stats => {
      const totalSize=stats.count;
      db.collection(resourceType)
   /* XXXXXXXXXXXXX Huawei IRC - Start  XXXXXXXXXXXXXXXx*/
   //Changed to findOne not many
   .findOne(query.criteria, query.options)
      .then(doc => {
        doc = cleanPayloadServiceType(doc);
        //res.setHeader('X-Total-Count',totalSize);
        //res.setHeader('X-Result-Count',doc.length);
        //var skip = query.options.skip!==undefined ? parseInt(query.options.skip) : 0;
        //var limit;
        //if(query.options.limit!==undefined) limit = parseInt(query.options.limit);        
        //if(limit || skip>0) setLinks(res,query,skip,limit,totalSize);

        //var code = 200;
        //if(limit && doc.length<totalSize) code=206;
        //sendDoc(res, code, doc);
   /* XXXXXXXXXXXXX Huawei IRC - End  XXXXXXXXXXXXXXXx*/
   if(doc) {
          doc = cleanPayloadServiceType(doc);
          console.log('doc: '+doc);
          sendDoc(res, 200, doc)        
        } else {
            sendError(res, new TError(TErrorEnum.RESOURCE_NOT_FOUND,"No resource with given id found"));
          }
      })
      .catch(error => {
        console.log("retrieveIntentReport: error=" + error);
        sendError(res, internalError);
      })
    })
    .catch(error => {
      console.log("retrieveIntentReport: error=" + error);
      sendError(res, internalError);
    })
  })
  .catch(error => {
    console.log("retrieveIntentReport: error=" + error);
    sendError(res, internalError);
  })



};



