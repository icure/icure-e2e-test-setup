FROM node:18-slim

WORKDIR /config

RUN npm install --global typescript
RUN npm install --global ts-node
RUN npm install --global tslib @types/node
RUN npm install axios
RUN npm install @icure/test-setup --save-dev
RUN echo '{ "compilerOptions": { "target": "esnext", "module": "nodenext", "moduleResolution": "node", "esModuleInterop": true, } }' >> tsconfig.json

CMD ["ts-node", "-e", "import { setupCouchDb, bootstrapOssKraken } from '@icure/test-setup';\
    setupCouchDb('couchdb-test', 5984).then( () => {\
        bootstrapOssKraken('9c4c1094-dcd6-487c-a231-5a2e0e1e604e',\
                'john',\
                '1796980233375ccd113c972d946b2c4a7892e4f69c60684cfa730150047f9c0b',\
                'couchdb-test',\
                5984).then( () => {\
            console.log('ok');\
            });\
        });\
"]