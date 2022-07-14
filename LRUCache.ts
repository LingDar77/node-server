export class LRUCache<Key, Value>
{
    private cache = new Map<Key, Value>();
    constructor(private size: number)
    {
        if (size <= 0) throw new Error('Invalid Size');
    }

    Set(key: Key, value: Value)
    {
        const val = this.cache.get(key);
        if (typeof val != 'undefined') {
            this.cache.delete(key);
            this.cache.set(key, value);
        }
        else {
            this.cache.set(key, value);
            if (this.cache.size > this.size) {
                const lastKey = () =>
                {
                    for (const k of this.cache.keys()) {
                        return k;
                    }
                    throw new Error('Invalid Operation');
                };
                this.cache.delete(lastKey());
            }

        }
    }
    Get(key: Key)
    {
        const val = this.cache.get(key);
        if (typeof val != 'undefined') {
            this.cache.delete(key);
            this.cache.set(key, val);
            return val;
        }

    }

}


export default LRUCache;