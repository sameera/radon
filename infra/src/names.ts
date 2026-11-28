// Fixed names of the Raiden deployment. One deployment lives in one AWS account and region, so
// fixed names are safe, and a change that would replace the table or the function fails instead of
// silently creating an empty table or a new address (D4, D5).
export const BACKEND_STACK: string = "RaidenBackend";
export const TABLE_NAME: string = "raiden";
export const FUNCTION_NAME: string = "raiden-backend";
export const WEB_STACK: string = "RaidenWeb";
export const CLIENT_SECRET_NAME: string = "raiden/github-client-secret";
export const SIGNIN_SETTINGS_NAME: string = "raiden/signin-settings";
export const BOOTSTRAP_STACK: string = "CDKToolkit";
// The backend zip that `nx run backend:build` writes.
export const LAMBDA_ZIP: string = ".tmp/lambda.zip";
