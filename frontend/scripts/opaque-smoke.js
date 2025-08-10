/*
 Simple Node smoke test to verify real OPAQUE authentication against the running backend.
 Usage:
   API_URL=http://localhost:8001 node scripts/opaque-smoke.js
*/

(async () => {
  try {
    // Ensure WebCrypto and TextEncoder in Node
    if (typeof global.crypto === 'undefined') {
      global.crypto = require('crypto').webcrypto;
    }
    if (typeof global.TextEncoder === 'undefined' || typeof global.TextDecoder === 'undefined') {
      const { TextEncoder, TextDecoder } = require('util');
      global.TextEncoder = TextEncoder;
      global.TextDecoder = TextDecoder;
    }

    const axios = require('axios');
    const opaque = require('@serenity-kit/opaque');

    if (opaque.ready) {
      await opaque.ready;
    }

    const baseURL = process.env.API_URL || 'http://localhost:8001';
    const api = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    const email = `opaque-smoke-${Date.now()}@example.com`;
    const password = 'CorrectHorseBatteryStaple-123!';
    const name = 'Opaque Smoke';

    // Registration: client start
    const { clientRegistrationState, registrationRequest } = opaque.client.startRegistration({
      password,
    });

    // Registration: server start
    const regStart = await api.post('/api/v1/auth/register/start', {
      userIdentifier: email,
      opaque_registration_request: registrationRequest,
      name,
    });

    const { session_id: regSessionId, opaque_registration_response } = regStart.data;

    // Registration: client finish
    const { registrationRecord } = opaque.client.finishRegistration({
      clientRegistrationState,
      registrationResponse: opaque_registration_response,
      password,
    });

    // Registration: server finish
    const regFinish = await api.post('/api/v1/auth/register/finish', {
      session_id: regSessionId,
      userIdentifier: email,
      opaque_registration_record: registrationRecord,
    });

    if (!regFinish.data || !regFinish.data.access_token) {
      throw new Error(`Registration finish response invalid: ${JSON.stringify(regFinish.data)}`);
    }

    // Login: client start
    const { clientLoginState, startLoginRequest } = opaque.client.startLogin({ password });

    // Login: server start
    const loginStart = await api.post('/api/v1/auth/login/start', {
      userIdentifier: email,
      client_credential_request: startLoginRequest,
    });

    const { session_id: loginSessionId, server_credential_response } = loginStart.data;

    // Login: client finish
    const { finishLoginRequest, sessionKey, exportKey } = opaque.client.finishLogin({
      clientLoginState,
      loginResponse: server_credential_response,
      password,
    });

    // Login: server finish
    const loginFinish = await api.post('/api/v1/auth/login/finish', {
      session_id: loginSessionId,
      userIdentifier: email,
      client_credential_finalization: finishLoginRequest,
    });

    if (!loginFinish.data || !loginFinish.data.access_token) {
      throw new Error(`Login finish response invalid: ${JSON.stringify(loginFinish.data)}`);
    }

    const token = loginFinish.data.access_token;
    const keyInfo = {
      sessionKeyType: typeof sessionKey,
      sessionKeyLen: sessionKey && sessionKey.length,
      exportKeyType: typeof exportKey,
      exportKeyLen: exportKey && exportKey.length,
    };

    console.log('OPAQUE OK', {
      baseURL,
      email,
      tokenPreview: token.substring(0, 24) + '...',
      keyInfo,
    });
    process.exit(0);
  } catch (err) {
    console.error('OPAQUE smoke test failed:', err?.message || err);
    process.exit(1);
  }
})();


