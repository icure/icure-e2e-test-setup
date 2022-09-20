FROM node:16-slim

WORKDIR /tmp

RUN npm install -g ts-node
RUN yarn add @icure/test-setup --dev
RUN npm install -g axios

CMD ["ts-node", "-e", "import { setupCouchDb, bootstrapCloudKraken } from '@icure/test-setup';\
    setupCouchDb('couchdb-test', 15984).then( () => {\
        console.log('ok');\
        });\
"]