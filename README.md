# Description

Full backoff jitter algorithm with options, variations and time testing.

## Usage

```
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