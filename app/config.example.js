// Copy this file to config.js and fill in values from the CloudFormation outputs.
window.APP_CONFIG = {
  apiUrl: 'https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com',
  cognitoDomain: 'https://YOUR_PREFIX.auth.YOUR_REGION.amazoncognito.com',
  clientId: 'YOUR_USER_POOL_CLIENT_ID',
  issuer: 'https://cognito-idp.YOUR_REGION.amazonaws.com/YOUR_USER_POOL_ID',
  redirectUri: 'https://YOUR_CLOUDFRONT_DOMAIN/',
  logoutUri: 'https://YOUR_CLOUDFRONT_DOMAIN/'
};
