/**
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise((resolve)=>{
        window.setTimeout(resolve, ms);
    });
}

/**
 * @typedef {{ events: Partial<Events> }} ConstructorOptions
 * @typedef {{ output: (str: string) => void }} Events
 */

/**
 * @typedef {Object} FullBackoffJitterSettings
 * @property {string} name
 * @property {number} connections
 * @property {number} maxConnections
 * @property {number} duration
 * @property {number} penalty
 * @property {number} maxAttempts
 * @property {number} maxSingleDuration
 * @property {number} maxAllDuration
 */

/**
 * @typedef {Partial<FullBackoffJitterSettings>} FullBackoffJitterOptions
 */

/**
 * @typedef {Object} State
 * @property {number} startMs
 * @property {number|null} endMs
 * @property {number|null} durationMs
 * @property {number|null} lastMs
 * @property {{ ms: number, isClash: boolean }[]} data
 * @property {number} successCount
 * @property {number} failureCount
 * @property {number} connectedCount
 */

/**
 * @return {State}
 */
function State() {
    return {
        startMs: Date.now(),
        endMs: null,
        durationMs: null,
        lastMs: null,
        data: [],
        successCount: 0,
        failureCount: 0,
        connectedCount: 0 // Current connections
    };
}

class FullBackoffJitter {

    /**
     * @param {ConstructorOptions} settings
     */
    constructor(settings = {}) {
        this.events = {
            output: console.log
        };

        if (settings.events) {
            for (let key in settings.events) {
                this.events[key] = settings.events[key];
            }
        }
    }

    /**
     * Compares time between immediate and full backup off jitter using options.
     * @param {FullBackoffJitterOptions} options 
     * @return {Promise} resolves state with 2 state results.
     */
    compare(options){

        const state = {
            /**
             * @type {State|null}
             */
            default: null,
            /**
             * @type {State|null}
             */
            fullBackoffJitter: null
        };

        options.name = 'Default';
        return this.time(this.executeImmediate.bind(this), options)
        .then((defState)=>{
            state.default = defState;
            options.name = 'Full backoff jitter';
            return this.time(this.executeWithFullBackoffJitter.bind(this), options)
        })
        .then((fullBackoffJitterState)=>{
            state.fullBackoffJitter = fullBackoffJitterState;
            return state;
        });
    }

    /**
     * Times handle with options such as failure penalty, max attempts, max simulatenous connections.
     * @param {Function} handle 
     * @param {FullBackoffJitterOptions} options 
     * Resolves state object with results data.
     */
    time(handle, options = {}) {
        let startMs = Date.now();
        let state = State()
        
        // Defaults
        options.connections = options.connections || 20;
        options.maxConnections = options.maxConnections || 5;
        options.duration = options.duration || 10;
        options.penalty = options.penalty || 100;
        options.maxAttempts = options.maxAttempts || 1;
        options.maxSingleDuration = options.maxSingleDuration || 30000; // Common timeout.
        // options.maxAllDuration = options.maxAllDuration || 60000; // 1 MINUTE

        /**
         * @type {Promise[]}
         */
        const promises = [];
        for(let i=0; i<options.connections; i++){
            promises.push(this._createPromise(handle, options, state));
        }

        return Promise.all(promises)
        .then(()=>{
            state.endMs = Date.now();
            state.durationMs = state.endMs - state.startMs;
            let sec = state.durationMs/1000;
            let batchName = options.name || 'Unnamed batch'
            this.events.output(`${batchName}. Batch End Duration(sec): ${sec}`);

            return state;
        });
    }

    /**
     * Executes immediately with NO full backoff jitter.
     * @param {Function} func
     * @param {FullBackoffJitterOptions} options
     */
    executeImmediate(func, options = {}) {
        const state = {
            attempts: 0
        };

        const MAX_ATTEMPTS = options.maxAttempts || 5;

        return new Promise((resolve, reject)=>{
            const nextRound = ()=>{
                if (state.attempts >= MAX_ATTEMPTS) {
                    return reject('MAX ATTEMPTS REACHED');
                }

                func()
                .then(resolve)
                .catch((err)=>{
                    // output('err:', err);
                    state.attempts++;
                    nextRound();
                });
            };
            nextRound();
        });
    }

    /**
     * This function can be used for any kind of connection for clever backupoff and jitter.
     * This function will reduce simultaneous reattempt clashes.
     * This function is especially useful for reconnections with timeouts by waiting longer per attempt to reduce high load times and increase chance of overall success.
     * For cloud services such as AWS which cost money per connection, this can reduce costs.
     * 
     * Returns promise.
     * func returns promise. Continues until max or resolve.
     * This function assumes it does not know how many connections are attempting to use func endpoint.
     * If the number of connections attempting connection is known, an estimation algorithm may give better results.
     * 
     * @see https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
     * @param {T} func
     * @param {FullBackoffJitterOptions} options
     **/
    executeWithFullBackoffJitter(func, options = {}) {
        // Backoff
        // Jitter

        let state = {
            attempts: 0,
            curSleepTime: 0
        };
        
        const MAX_ATTEMPTS = options.maxAttempts || 10;
        const randomBetween = (a, b) => { // a > b MUST = true
            const diff = b - a;
            return (a + (Math.random() * diff));
        };
        // Makes exponentially larger
        const backupFunc = (n)=>{
            const BASE = 3;
            const CONSTANT = 100; // Constant important for first attempts due to low values.
            const MULTIPLIER = 10;
            const EXPONENT = n; // Exponent important for later attempts to make take a lot longer.
            return (Math.pow(BASE, EXPONENT) * MULTIPLIER) + CONSTANT;
        };
        // Creates randomization.
        const jitterFunc = (n, random=10)=>{
            return Math.round(randomBetween(n - random, n + random)); // min must be 1 or more.
        };
        // Should be between min & double larger.
        const backoffJitterFunc = (n) => { // n=attempt number
            if (!n) { n = 1; }
            let ms = backupFunc(n);
            if (ms > options.maxSingleDuration) {
                ms = options.maxSingleDuration;
            }
            ms = jitterFunc(ms, ms/2);
            console.log('ms', ms);
            return ms;
        };

        return new Promise((resolve, reject)=>{
            const nextRound = ()=>{
                if (state.attempts >= MAX_ATTEMPTS) {
                    return reject('MAX ATTEMPTS REACHED');
                }

                func()
                .then(resolve)
                .catch((err)=>{
                    // output('err:', err);
                    state.attempts++;
                    state.curSleepTime = backoffJitterFunc(state.attempts);
                    sleep(state.curSleepTime).then(nextRound);
                });
            };
            nextRound();
        });
    }

    /**
     * Creates promise for single connection.
     * Multiple connections usually tested.
     * @param {Function} handle 
     * @param {FullBackoffJitterOptions} options
     * @param {State} state 
     * @return {Promise}
     */
    _createPromise(handle, options, state) {
        
        // Single execution
        const f = ()=>{

            // Clash info
            let curMs = Date.now();
            let isClash = false;
            if(state.connectedCount >= options.maxConnections){
                isClash = true;
            }

            // Point data
            state.data.push({
                ms: curMs - state.startMs,
                isClash: isClash
            });

            return new Promise((resolve, reject)=>{
                // this.events.output((isClash ? 'Clashed' : 'OK'));
                if (!isClash) {
                    state.lastMs = curMs;
                    state.connectedCount++;

                    sleep(options.duration)
                    .then(()=>{
                        state.connectedCount--;
                        return resolve();
                    });
                }

                else {
                    sleep(options.penalty).then(()=>{
                        return reject();
                    });
                }
            });
        };

        // Execution until max/complete.
        return new Promise((resolve, reject)=>{
            handle(f, options)
            .then(()=>{
                state.successCount++;
                // this.events.output('SUCCESS');
                resolve();
            })
            .catch(()=>{
                state.failureCount++;
                // this.events.output('MAX ATTEMPTS REACHED');
                resolve();
            }); 
        });
    }
}

export default FullBackoffJitter
