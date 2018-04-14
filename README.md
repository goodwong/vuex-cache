
# Vuex 2 cache

使用vuex与vue-resource结合2.0版

> **注意：** 未完成，时间仓促，文档有点乱哈～


## 特色
1. 数据缓存，相同的请求不会再发送第二次
2. 并发定相同请求自动合并，比如两个列表同时请求用户1的数据，会自动合并成一个请求
3. 节省代码，基本上两三行代码定义一个`vuex module`，使用的时候只用 `dispatch` + `computed` 几个属性
4. 支持分页器
5. 支持`LOAD_MORE`方式加载数据
6. ~~支持数据离线缓存~~（`未完成`）

## 安装

使用npm安装（未发布node package，请使用`git submodule`或`git subtree`的方式添加吧）
```shell
npm install vuex-resource --save
```


## 快速教程

1. 建立store

  ```js
  // src/store/index.js

  import Vue from 'vue'
  import Vuex from 'vuex'
  import production from './production'
  
  Vue.use(Vuex)
  
  const store = new Vuex.Store({
    modules: {
      production
    }
  })
  
  export default store
  ```

2. 创建module

  ```js
  // src/store/production.js

  import builder from 'vuex-resource'
  export default builder('productions') // 参数是api地址
  ```
  
3. 使用

  ```html
  // production.module/production-list.page/index.vue

  <template>
    <div class='production-list-page'>
      <pre>{{ productions }}</pre>
    </div>
  </template>

  <script>
    export default {
      name: 'production-list-page',
      computed: {
        productions () {
          return this.$store.getters['production/items']() // **注意，不能漏了()**
        }
      },
      created () {
        this.$store.dispatch('production/LOAD')
      }
    }
  </script>
  ```

## 用法

1. 加载列表

  ```js
  this.$store.dispatch('production/LOAD').then(items => {})
  ```

2. 查找（单个）

  ```js
  this.$store.dispatch('production/FIND', { id }).then(item => {})
  ```

3. 创建

  ```js
  this.$store.dispatch('production/CREATE', { payload }).then(item => {})
  ```

4. 更新

  ```js
  // （建议）payload 仅包含需要变更的部分
  this.$store.dispatch('production/UPDATE', { id, payload }).then(item => {})
  ```

5. 删除

  ```js
  this.$store.dispatch('production/DELETE', { id }).then(() => {})
  ```

6. 使用getters

  ```js
  // 注意，getters返回的是方法，需要执行这个方法才会返回数据
  // 任何模块都有items/item/pagination这几个getters，其它的getters需要自行添加
  return this.$store.getters['production/item']()
  return this.$store.getters['production/items']()
  return this.$store.getters['production/pagination']()
  ```

7. 使用state

  ```js
  this.$store.state.production.items // 注意，items是一个Object
  ```

## 高级

### 资源路径带参数

举个例子，有时api的形式是获取某家商店下的所有产品，
```js
  export default builder('shops/:shop_id/productions?with=sale')
```

调用action的方式：
```js
  this.$store.dispatch('production/LOAD', { params: {shop_id: 3} })
  // GET http(s)://your.domain.name/shops/3/productions?with=sale

  this.$store.dispatch('production/LOAD_MORE', { params: {shop_id: 3, page: 2} })
  // GET http(s)://your.domain.name/shops/3/productions?with=sale&page=2

  this.$store.dispatch('production/FIND', { id, params: {shop_id: 3} })
  // GET http(s)://your.domain.name/shops/3/productions/15?with=sale

  this.$store.dispatch('production/CREATE', { payload, params: {shop_id: 3} })
  // POST http(s)://your.domain.name/shops/3/productions?with=sale

  this.$store.dispatch('production/UPDATE', { id, payload, params: {shop_id: 3} })
  // PUT http(s)://your.domain.name/shops/3/productions/15?with=sale

  this.$store.dispatch('production/DELETE', { id, params: {shop_id: 3} })
  // DELETE http(s)://your.domain.name/shops/3/productions/15?with=sale
```

### 缓存

1. 所有的数据是通的，举例说：
   你在导航栏里有某商家的一份产品分类列表，同时你在分类管理里面更新了某分类的名称，那么导航栏里的对应分类会自动更新；
   增加、删除分类同样会即时'同步'到导航栏上。

2. 有些场景下，列表可能会有许多个，~~列表与与列表之间可能存在交集，~~

```js
  // cache 只是用来区分列表的一个key，只要唯一就可以。可以是字符串也可以是数字，如
  this.$store.dispatch('production/LOAD', { cache: 'shop_3', params: {shop_id: 3} })
  this.$store.dispatch('production/LOAD', { cache: 3, params: {shop_id: 3} })

  this.$store.dispatch('production/CREATE', { cache: 3, payload, params: {shop_id: 3} })

  this.$store.dispatch('production/DELETE', { cache: 3, id, params: {shop_id: 3} })

  this.$store.getters['production/list'](3)
```
> `LOAD`、`LOAD_MORE`、`CREATE`默认的cache是`ALL`  
> `FIND` 默认是`CURRENT`

3. 有时候需要强制拉取数据：

```js
  // 如根据关键词搜索时
  this.$store.dispatch('production/LOAD', { refresh: true, params: {keyword: 'xx'} })
  // 如重新获取单个对象
  this.$store.dispatch('production/FIND', { refresh: true, id })
```


### 添加更多的`actions` `mutations` `getters`
```js
  const module = builder('productions')

  function knock (id) {
    return Vue.http.put('api/endpoint', { id }).then(r => r.json())
  }
  module.actions.knock = ({ state, commit }, { id }) => {
    return knock(id)
  }

  export default module
```

另一种更加简单又强大的方式
> V2版本尚未测试确认!

```js
import builder from './builder'

const base = builder('user-attributes')

// http://tool.chinaz.com/tools/use
let colors = [
  '#FFCCCC',
  '#CCCCFF',
  '#99CC66',
  '#0066CC',
  '#CCCC00',
  '#99CCCC',
  '#0099CC',
  '#CC3333',
  '#CCCCCC',
  '#FFFF00',
  '#996699'
]

export default {
  namespaced: true, // **注意不能漏掉**
  state: {
    colors: {},
    ...base.state
  },
  actions: {
    ...base.actions
  },
  mutations: {
    ...base.mutations
  },
  getters: {
    color: (state) => (attributeId, tag) => {
      let attribute = state.items[attributeId]
      if (attribute.settings.options.indexOf(tag) === -1) {
        attribute.settings.options.push(tag)
      }
      return colors[attribute.settings.options.indexOf(tag)]
    },
    ...base.getters
  }
}

```


## roadmap

- 缓存到localStorage（有单独的过期时间），可以强制刷新

- 解耦vue-resource




## 与同类插件的对比

在准备要发布npm的时候，发现一个类似的插件[vuex-rest-api](https://www.npmjs.com/package/vuex-rest-api)，
然后想要不要放弃，于是详细看了一下它的文档。主要的异同点：

1. vuex-rest-api需要自己添加actions，这个比较费代码

2. 没有对数据的缓存功能，有些数据会在很多地方使用，需要减少重复请求

基于以上2点，还是觉得要继续发布。唉，可惜了这个npm包名被占用了~（犹豫了一下，又不知道什么原因没有发布）


2018-4-14

还发现另一个npm包：vuex-cache，但它的侧重点只在于请求本身的缓存。
