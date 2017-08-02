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

export default function builder (_api) {
  function get (params) {
    let api = _api
    api = fill(api, params)
    return Vue.http.get(api, { params }).then(r => r.json())
  }

  function find (id, params) {
    let api = endpoint(_api, id)
    api = fill(api, params)
    return Vue.http.get(api, { params }).then(r => r.json())
  }

  function create (payload, params) {
    let api = _api
    api = fill(api, params)
    return Vue.http.post(api, payload, { params }).then(r => r.json())
  }

  function update (id, payload, params) {
    let api = endpoint(_api, id)
    api = fill(api, params)
    // return Vue.http.put(endpoint(api, id), payload).then(r => r.json())

    // fix bug for laravel request parse on PUT
    // see: https://github.com/laravel/framework/issues/13457#issuecomment-239451567

    // (1)
    // if (payload.append) {
    //   payload.append('_method', 'PUT')
    // } else {
    //   payload._method = 'PUT'
    // }

    // (2)
    params = params || {}
    params._method = 'PUT'

    return Vue.http.post(api, payload, { params }).then(r => r.json())
  }

  function destroy (id, params) {
    let api = endpoint(_api, id)
    api = fill(api, params)
    return Vue.http.delete(api, { params })
  }

  function endpoint (endpoint, id) {
    if (endpoint.indexOf('?') > -1) {
      return endpoint.replace(/\?/, `/${id}?`)
    } else {
      return endpoint + `/${id}`
    }
  }

  function fill (api, params) {
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

  return {
    namespaced: true,

    state: {
      items: {
        /* id: item */
      },
      lists: {
        /* parent_id: [id, id, ...] */
      }
    },

    actions: {
      LOAD ({ state, commit }, payload) {
        payload = payload || {}
        let { parent, params, cache } = payload
        parent = parent || 'defalut'
        cache = typeof cache === 'undefined' ? true : cache
        let ids = state.lists[parent]
        if (ids && cache) {
          return Promise.resolve(ids.map(id => state.items[id]))
        }
        return get(params)
        .then(items => {
          commit('SET', items)
          if (cache) {
            commit('SET_LIST', { parent, list: items.map(i => i.id) })
          }
          return items
        })
      },
      FIND ({ state, commit }, { id, params, cache }) {
        let item = state.items[id]
        cache = typeof cache === 'undefined' ? true : cache
        if (item && cache) {
          return Promise.resolve(item)
        }
        return find(id, params)
        .then(item => {
          commit('SET_ITEM', item)
          return item
        })
      },
      CREATE ({ state, commit }, { parent, params, payload }) {
        parent = parent || 'defalut'
        return create(payload, params)
        .then(item => {
          commit('SET_ITEM', item)
          if (state.lists[parent]) {
            commit('APPEND_LIST', { parent, id: item.id })
          }
          return item
        })
      },
      UPDATE ({ state, commit }, { id, payload, params }) {
        return update(id, payload, params)
        .then(item => {
          commit('SET_ITEM', item)
          return item
        })
      },
      DELETE ({ state, commit }, { parent, id, params }) {
        parent = parent || 'defalut'
        return destroy(id, params)
        .then(() => {
          commit('DEL_ITEM', id)
          if (state.lists[parent]) {
            commit('REMOVE_LIST_ITEM', { parent, id })
          }
        })
      }
    },

    mutations: {
      SET_LIST (state, { parent, list }) {
        Vue.set(state.lists, parent, list)
      },
      APPEND_LIST (state, { parent, id }) {
        state.lists[parent].push(id)
      },
      REMOVE_LIST_ITEM (state, { parent, id }) {
        let index = state.lists[parent].indexOf(id)
        state.lists[parent].splice(index, 1)
      },
      SET (state, items) {
        items.forEach(item => {
          Vue.set(state.items, item.id, item)
        })
      },
      SET_ITEM (state, item) {
        Vue.set(state.items, item.id, item)
      },
      DEL_ITEM (state, id) {
        Vue.delete(state.items, id)
      }
    },

    getters: {
      list: (state) => (parent) => {
        parent = parent || 'defalut'
        let list = state.lists[parent]
        return list ? list.map(i => state.items[i]).filter(i => i).sort((a, b) => a.id - b.id) : []
      }
    }
  }
}
