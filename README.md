# Description

Full backoff jitter algorithm with options, variations and time testing.

Uses es6 imports/exports. For commonjs, global, please build. If is considered a common case, please create an issue or pull request.

## Usage

```javascript
const options = {
    connections: 20,
    maxConnections: 5,
    duration: 10,
    penalty: 100,
    maxAttempts: 1,
    maxSingleDuration: 30000
};

const fullBackoffJitter = FullBackoffJitter();
fullBackoffJitter.executeWithFullBackoffJitter(func, options)
.then(console.log)
.catch(console.error);
```

## Test

```bash
npx http-server ./
# http://localhost:8080/index.html
```
