# data_api

The Cloudlet Platforms data_api component handles data request from the mongrel2 web server and processes them and passes them on to other Cloudlet Platform components for more processing.

## Getting Started
Install the module with: `npm install git+ssh://git@gitlab.openi-ict.eu:data_api.git`

You will need to install the following through macports or aptitude.

```bash
sudo port install JsCoverage
sudo port install phantomjs
```

or

```bash
sudo apt-get install JsCoverage
sudo apt-get install phantomjs
```

To build the project enter the following commands. Note: npm install is only required the first time the module is built or if a new dependency is added. There are a number of grunt tasks that can be executed including: test, cover, default and jenkins. The jenkins task is executed on the build server, if it doesn't pass then the build will fail.

```bash
git clone git@gitlab.openi-ict.eu:data_api.git
cd data_api
npm install
grunt jenkins
```

To start the component enter:

```javascript
node lib/main.js
```

## Documentation

How are we gonna document the APIs???? I'm not sure if markdown is good enough.

Right now the following http actions are supported.

```
POST/data/put/*var_name* with a JSON body.              Simply saves the JSON body in the couch database with the given *var_name* and returns the result.
GET /v1/data/*cloudlet_id*/*object_name*                Retrieves the JSON object *object_name* within *cloudlet_id*.
GET /v1/data/*cloudlet_id*/*object_name/*var_name*      Retrieves the JSON value for the given *var_name* from *object_name* within cloudlet_id*.
GET /v1/data/*cloudlet_id*/type/*data_type*?*query*     Retrieves the JSON Array of Objects that match *query* of type *data_type* in *cloudlet_id*.
```

**Alternative documentation**

Sample incoming message.

```javascript
{ Headers: {
    "PATH": "/data/v1/data/000003/test1",
    "x-forwarded-for": "127.0.0.1",
    "content-type": "application/json",
    "accept-language": "en-US,en;q=0.8,en-GB;q=0.6",
    "accept-encoding": "gzip,deflate,sdch",
    "connection": "keep-alive",
    "accept": "*/*",
    "user-agent": "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/30.0.1599.101 Safari/537.36",
    "host": "localhost",
    "METHOD": "GET",
    "VERSION": "HTTP/1.1",
    "URI": "/data/v1/data/000003/test1",
    "PATTERN": "/data"},
  body: '',
  uuid: '81b7114c-534c-4107-9f17-b317cfd59f62',
  connId: '21',
  path: '/data/echo/asdasd',
  json: null
}
```


## Contributors

* Donal McCarthy (dmccarthy@tssg.org)
* David Benson   (dbenson@tssg.org)
* Dylan Conway (dconway@tssg.org)


## Release History
**0.1.0** *(23/10/14 dmccarthy@tssg.org)* First version of the data API module.


## License
Copyright (c) 2013
Licensed under the MIT license.

