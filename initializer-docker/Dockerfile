FROM node:18-slim

WORKDIR /config

RUN npm install --global typescript
RUN npm install --global ts-node
RUN npm install --global tslib @types/node
RUN npm install axios
RUN yarn add @icure/test-setup --dev
RUN echo '{\
            "compilerOptions": {\
              "target": "esnext",\
              "module": "nodenext",\
              "moduleResolution": "node",\
              "esModuleInterop": true,\
             }\
          }' >> tsconfig.json

CMD ["ts-node", "-e", "export {};\
    import { setupCouchDb, bootstrapCloudKraken } from '@icure/test-setup';\
    setupCouchDb().then( () => {\
        console.log('ok');\
    });"]