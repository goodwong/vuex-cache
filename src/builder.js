/**
 * 通用RESTful资源模板
 *
 * 缓存的难点：
 * 1. 有些api结构是`categories/${category_id}/templates`，这个可以通过传递额外的id处理
 *    但是api的结构会有点问题，建议后端统一按 `templates?category_id=13`的方式，适用性高
 * 2. 有些api有复杂的查询参数，如search，这种缓存意义不大，加参数 { cache: false }
 * 3. 翻页器的缓存也不容易处理，或者将parent设置为`${category_id}-${page_id}`？
 * 4. 若缓存了，则create/destroy需要增删lists里的内容，这个如何解决？传递parent参数
 */

import Vue from 'vue'

const defaultResolvers = {
  id: response => response.id,
  item: response => response,
  items: response => response.data || response,
  pagination: response => response.data ? { total: response.total, per_page: response.per_page, current_page: response.current_page, last_page: response.last_page } : null
}

class Http {
  api = null

  constructor (_api) {
    this.api = _api
  }

  get (params) {
    let api = this._fill(this.api, params)
    return Vue.http.get(api, { params }).then(r => r.json())
  }

  find (id, params) {
    let api = this._fill(this._endpoint(this.api, id), params)
    return Vue.http.get(api, { params }).then(r => r.json())
  }

  create (payload, params) {
    let api = this._fill(this.api, params)
    return Vue.http.post(api, payload, { params }).then(r => r.json())
  }

  update (id, payload, params) {
    let api = this._fill(this._endpoint(this.api, id), params)
    // return Vue.http.put(api, payload).then(r => r.json())

    // fix bug for laravel request parse on PUT
    // see: https://github.com/laravel/framework/issues/13457#issuecomment-239451567
    params = params || {}
    params._method = 'PUT'
    return Vue.http.post(api, payload, { params }).then(r => r.json())
  }

  destroy (id, params) {
    let api = this._fill(this._endpoint(this.api, id), params)
    return Vue.http.delete(api, { params })
  }

  /**
   * 在api后面加上:id
   */
  _endpoint (_endpoint, id) {
    return _endpoint.indexOf('?') > -1 ? _endpoint.replace(/\?/, `/${id}?`) : `${_endpoint}/${id}`
  }

  /**
   * 用params里的参数替换掉api里的placeholder，同时移除掉params里的项目
   */
  _fill (api, params) {
    if (!params) {
      return api
    }
    let placeholders = api.match(/:\w+/g)
    if (!placeholders) {
      return api
    }
    placeholders.forEach(p => {
      let key = p.substr(1)
      if (params[key]) {
        api = api.replace(p, params[key])
        delete params[key]
      }
    })
    return api
  }
}

export default function builder (api, resolvers) {
  // http 请求类
  const http = new Http(api)

  // http 结果解析器，可以自定义
  resolvers = resolvers || defaultResolvers

  // http 请求缓存
  let fetchings = {}

  return {
    namespaced: true,

    state: {
      items: {
        /* id: item */
      },
      caches: {
        /*
        profile: {
          type: 'local:15d', // local | runtime
          params: '' // 排序过后的字符串，用于判断是否需要更新
          ids: [1] // FIND 也需要这么定义
          pagination: null || {
            total: 105,
            last: 5,
            current: 1
          }
        }
        */
      },
      loading: {
        /*
        ALL: false
        */
      },
      submitting: {
        /*
        ALL: false
        */
      }
    },

    actions: {
      LOAD ({ state, commit }, payload) {
        payload = payload || {}
        let { cache, params, refresh } = payload
        cache = cache || 'ALL'
        let paramSerialized = serialize(params)

        /**
         * 步骤：
         * 1. refresh
         * 2. 是否有缓存？
         * 3. 缓存的params是否一致
         *
         * 以上任一不符：
         * 1. 请求
         * 2. 存储fetchings
         * 3. 存储params
         * 4. 存储ids
         * 5. 存储items
         * 5. 存储pagination
         * 6. 删除fetchings
         */

        // cache
        let cached = state.caches[cache]
        if (cached && cached.params !== paramSerialized) {
          cached = null
        }
        if (!refresh && cached) {
          console.log(`LOAD(${cache}) ${api}@${paramSerialized} ... [Result cache hit!]:`)
          return Promise.resolve(cached.ids.map(id => state.items[id]))
        }

        // fetching...
        let fetchKey = `LOAD:${cache}:${paramSerialized}`
        if (fetchings[fetchKey]) {
          console.log(`LOAD(${cache}) ${api}@${paramSerialized} ... [Fetching cache hit!]:`)
          return fetchings[fetchKey]
        }

        // request...
        commit('SET_LOADING', { cache, value: true })
        fetchings[fetchKey] = http.get(params)
          .then(response => {
            // set
            let items = resolvers.items(response)
            commit('ASSIGN', items)
            let ids = items.map(i => resolvers.id(i))
            let pagination = resolvers.pagination(response)
            commit('SET_CACHE', { cache, ids, pagination, params: paramSerialized })
            // remove...
            commit('CLEAN_UNUSED_ITEMS')
            // clear...
            commit('SET_LOADING', { cache, value: false })
            delete fetchings[fetchKey]
            return items
          })
          .catch(e => {
            console.error(e)
            // clear...
            commit('SET_LOADING', { cache, value: false })
            delete fetchings[fetchKey]
            // re-throw
            throw e
          })
        return fetchings[fetchKey]
      },
      LOAD_MORE ({ state, commit }, payload) {
        payload = payload || {}
        let { cache, params, refresh } = payload
        cache = cache || 'ALL'
        let paramSerialized = serialize(params)

        // cache
        let cached = state.caches[cache]
        if (cached && cached.params !== paramSerialized) {
          cached = null
        }
        if (!refresh && cached) {
          console.log(`LOAD_MORE(${cache}) ${api}@${paramSerialized} ... [Result cache hit!]:`)
          return Promise.resolve(cached.ids.map(id => state.items[id]))
        }

        // fetching...
        let fetchKey = `LOAD_MORE:${cache}:${paramSerialized}`
        if (fetchings[fetchKey]) {
          console.log(`LOAD_MORE(${cache}) ${api}@${paramSerialized} ... [Fetching cache hit!]:`)
          return fetchings[fetchKey]
        }

        // request...
        commit('SET_LOADING', { cache, value: true })
        fetchings[fetchKey] = http.get(params)
          .then(response => {
            // set
            let items = resolvers.items(response)
            commit('ASSIGN', items)
            let ids = items.map(i => resolvers.id(i))
            let cached = state.caches[cache]
            if (cached) {
              ids = cached.ids.concat(ids)
            }
            ids = [...new Set(ids)] // unique
            let pagination = resolvers.pagination(response)
            commit('SET_CACHE', { cache, ids, pagination, params: paramSerialized })
            // remove...
            commit('CLEAN_UNUSED_ITEMS')
            // clear...
            commit('SET_LOADING', { cache, value: false })
            delete fetchings[fetchKey]
            return ids.map(id => state.items[id])
          })
          .catch(e => {
            console.error(e)
            // clear...
            commit('SET_LOADING', { cache, value: false })
            delete fetchings[fetchKey]
            // re-throw
            throw e
          })
        return fetchings[fetchKey]
      },
      FIND ({ state, commit }, { cache, id, params, refresh }) {
        cache = cache || 'CURRENT'
        let paramSerialized = serialize(params)

        // cached
        let cached = state.caches[cache]
        if (cached && cached.params !== paramSerialized) {
          cached = null
        }
        if (cached && cached.ids[0] !== id) {
          cached = null
        }
        if (!refresh && cached) {
          console.log(`FIND(${cache}):${id} ${api}@${paramSerialized} ... [Result cache hit!]:`)
          return Promise.resolve(state.items[id])
        }

        // fetching...
        let fetchKey = `FIND:${cache}:${paramSerialized}`
        if (fetchings[fetchKey]) {
          console.log(`FIND(${cache}):${id} ${api}@${paramSerialized} ... [Fetching cache hit!]:`)
          return fetchings[fetchKey]
        }

        // request...
        commit('SET_FINDING', { cache, value: true })
        fetchings[fetchKey] = http.find(id, params)
          .then(response => {
            // set
            let item = resolvers.item(response)
            commit('SET_ITEM', item)
            let id = resolvers.id(item)
            commit('SET_CACHE', { cache, ids: [id], params: paramSerialized })
            // remove...
            commit('CLEAN_UNUSED_ITEMS')
            // clear...
            commit('SET_FINDING', { cache, value: false })
            delete fetchings[fetchKey]
            return item
          })
          .catch(e => {
            console.error(e)
            // clear...
            commit('SET_FINDING', { cache, value: false })
            delete fetchings[fetchKey]
            // re-throw
            throw e
          })
        return fetchings[fetchKey]
      },
      CREATE ({ state, commit }, { cache, params, payload }) {
        cache = cache || 'ALL'
        commit('SET_SUBMITTING', { cache, value: true })
        return http.create(payload, params)
          .then(response => {
            // set
            let item = resolvers.item(response)
            let id = resolvers.id(item)
            commit('SET_ITEM', item)
            // cache
            let cached = state.caches[cache]
            if (cached) {
              commit('APPEND_CACHE_ITEM', { cache, id })
            }
            // clear...
            commit('SET_SUBMITTING', { cache, value: false })
            return item
          })
          .catch(e => {
            console.error(e)
            // clear...
            commit('SET_SUBMITTING', { cache, value: false })
            // re-throw
            throw e
          })
      },
      UPDATE ({ state, commit }, { cache, id, params, payload }) {
        cache = cache || 'CURRENT'
        commit('SET_SUBMITTING', { cache, value: true })
        return http.update(id, payload, params)
          .then(item => {
            commit('SET_ITEM', item)
            // clear...
            commit('SET_SUBMITTING', { cache, value: false })
            return item
          })
          .catch(e => {
            console.error(e)
            // clear...
            commit('SET_SUBMITTING', { cache, value: false })
            // re-throw
            throw e
          })
      },
      DELETE ({ state, commit }, { cache, id, params }) {
        cache = cache || 'CURRENT'
        commit('SET_SUBMITTING', { cache, value: true })
        return http.destroy(id, params)
          .then(() => {
            commit('DEL_ITEM', id)
            // 检查所有的caches，如果含有这个id，则去掉
            Object.keys(state.caches)
              .filter(key => state.caches[key].ids.indexOf(id) > -1)
              .forEach(key => {
                commit('REMOVE_CACHE_ITEM', { cache: key, id })
              })
            // clear...
            commit('SET_SUBMITTING', { cache, value: false })
          })
          .catch(e => {
            console.error(e)
            // clear...
            commit('SET_SUBMITTING', { cache, value: false })
            // re-throw
            throw e
          })
      }
    },

    mutations: {
      SET_CACHE (state, { cache, ids, pagination, params }) {
        Vue.set(state.caches, cache, { ids, pagination, params })
      },
      CLEAN_UNUSED_ITEMS (state) {
        let keeps = Object.keys(state.caches)
          .map(i => state.caches[i].ids.join(','))
          .join(',')
          .split(',')
        Object.keys(state.items).forEach(id => {
          if (keeps.indexOf(id) === -1) {
            Vue.delete(state.items, id)
          }
        })
      },
      APPEND_CACHE_ITEM (state, { cache, id }) {
        state.caches[cache] && state.caches[cache].ids.push(id)
      },
      REMOVE_CACHE_ITEM (state, { cache, id }) {
        if (!state.caches[cache]) {
          return
        }
        let index = state.caches[cache].ids.indexOf(id)
        state.caches[cache].ids.splice(index, 1)
      },
      ASSIGN (state, items) {
        items.forEach(item => {
          Vue.set(state.items, resolvers.id(item), item)
        })
      },
      SET_ITEM (state, item) {
        let id = resolvers.id(item)
        if (!state.items[id]) {
          Vue.set(state.items, id, item)
        } else {
          // 避免字段少的覆盖字段多的情况出现
          Vue.set(state.items, id, {
            ...state.items[id],
            ...item
          })
        }
      },
      DEL_ITEM (state, id) {
        Vue.delete(state.items, id)
      },
      SET_LOADING (state, { cache, value }) {
        cache = cache || 'ALL'
        if (value) {
          Vue.set(state.loading, cache, true)
        } else {
          delete state.loading[cache]
        }
      },
      SET_FINDING (state, { cache, value }) {
        cache = cache || 'CURRENT'
        if (value) {
          Vue.set(state.finding, cache, true)
        } else {
          delete state.finding[cache]
        }
      },
      SET_SUBMITTING (state, { cache, value }) {
        cache = cache || 'CURRENT'
        if (value) {
          Vue.set(state.submitting, cache, true)
        } else {
          delete state.submitting[cache]
        }
      }
    },

    getters: {
      items: (state) => (cache) => {
        cache = cache || 'ALL'
        let cached = state.caches[cache]
        if (!cached) {
          return []
        }
        return cached.ids
          .map(i => state.items[i])
          .filter(i => i)
      },
      item: (state) => (cache) => {
        cache = cache || 'CURRENT'
        let cached = state.caches[cache]
        if (!cached) {
          return null
        }
        return state.items[cached.ids[0]]
      },
      pagination: (state) => (cache) => {
        cache = cache || 'ALL'
        let cached = state.caches[cache]
        if (!cached) {
          return {}
        }
        return cached.pagination
      },
      loading: (state) => (cache) => {
        return state.submitting[cache]
      },
      finding: (state) => (cache) => {
        return state.finding[cache]
      },
      submitting: (state) => (cache) => {
        return state.submitting[cache]
      }
    }
  }

  function serialize (params) {
    if (!params) {
      return null
    }
    return Object.keys(params).sort().map(key => `${key}=${params[key]}`).join('&')
  }
}
