//////////////////////////////////////////////////////
/*              Ericsson IRC                        */
/*              Idan Catalyst                       */
/* SOUtils:                                         */
/* Functions to invoke Service Orchestrator         */
//////////////////////////////////////////////////////

'use strict';

var fs = require('fs'),
    path = require('path'),
    jsyaml = require('js-yaml');

const {TError, TErrorEnum, sendError} = require('./errorUtils');
const swaggerUtils = require('./swaggerUtils');
const mongoUtils = require('./mongoUtils');
const intentService = require('../service/IntentService');
const $rdf = require('rdflib');
const uuid = require('uuid');
const notificationUtils = require('./notificationUtils');

var spec = null;
var swaggerDoc = null;
var token = null;

var SO_BASE_URL;
var SO_USERNAME;
var SO_PASSWORD;

/////////////////////////////////////////
// Function reads the SO config file   //
/////////////////////////////////////////
function readSoConfig() {
  var soConfig;
  try {
    soConfig = require('../soconfig.json');
    console.log("Loaded soconfig");
    SO_BASE_URL = soConfig.SO_BASE_URL;
    SO_USERNAME = soConfig.SO_USERNAME;
    SO_PASSWORD = soConfig.SO_PASSWORD;
  } catch (e) {
    console.log(e)
  }
}

/////////////////////////////////////////////
// Function performs login to the SO       //
// and stores the token for subsequent use //  
/////////////////////////////////////////////
async function storeSoTokenAfterLogin() {
  readSoConfig();
  const response = await fetch(SO_BASE_URL + "/sso_rest/authentication/login", {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: `{
      "username": "${SO_USERNAME}",
      "password": "${SO_PASSWORD}",
      "source": "SIMF",
      "idOrigin": "0.0.0.0"
    }`,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Http response was not OK');
      }
      return response.json();
    })
    .then((jsonResp) => {
      token = jsonResp._embedded.session.token;
      console.log("SO Token = " + token);
    })
    .catch((error) => {
      console.error('SO: storeSoTokenAfterLogin failed with error:', error);
    });
}

//////////////////////////////////////////////////////
// Function sends the service order to SO           //
//////////////////////////////////////////////////////
async function sendServiceOrder(order) {
  const response = await fetch(SO_BASE_URL + "/service-order-manager/api/service-orders/", {
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'X-Organization-Code': 'IDANCATALYST',
      'X-Authorization': token,
      'Content-Type': 'application/iway-service-order-post-v1-hal+json'
    },
    body: order,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error('Http response was not OK');
      }
      console.log("Service Order sent successfully!");
    })
    .catch((error) => {
      console.error('SO: sendServiceOrder failed with error:', error);
    });
}


module.exports = { 
  storeSoTokenAfterLogin,
  sendServiceOrder
				   			 };
