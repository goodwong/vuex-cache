
# Vuex 2 cache

使用vuex与vue-resource结合2.0版

> **注意：** 未完成，时间仓促，文档有点乱哈～


## 特色
1. 数据缓存，相同的请求不会再发送第二次
2. 并发定相同请求自动合并，比如两个列表同时请求用户1的数据，会自动合并成一个请求
3. 节省代码，基本上两三行代码定义一个`vuex module`，使用的时候只用 `dispatch` + `computed` 几个属性
4. 支持分页器
5. 支持`LOAD_MORE`方式加载数据
6. 自动维护数据等`loading`、`submitting`等状态
6. ~~支持数据离线缓存~~（`未完成`）

## 安装

使用npm安装（未发布node package，请使用`git submodule`或`git subtree`的方式添加吧）
```shell
npm install vuex-cache --save
```


## 快速教程

1. 建立store

  ```js
  // src/store/index.js

  import Vue from 'vue'
  import Vuex from 'vuex'
  import Order from './order'
  
  Vue.use(Vuex)
  
  const store = new Vuex.Store({
    modules: {
      Order
    }
  })
  
  export default store
  ```

2. 创建module

  ```js
  // src/store/order.js

  import builder from 'vuex-cache/builder'
  export default builder('api/client/orders') // 参数是api地址
  ```
  
3. 使用

  ```html
  // order/order-list/index.vue

  <template>
    <div class='order-list' v-if='loading'>
      <pre>{{ orders }}</pre>
      <pre>{{ pagination }}</pre>
    </div>
  </template>

  <script>
    export default {
      name: 'order-list',
      computed: {
        orders () {
          return this.$store.getters['Order/items']() // **注意，不能漏了()**
        },
        pagination () {
          return this.$store.getters['Order/pagination']()
        },
        loading () {
          return this.$store.getters['Order/loading']()
        }
      },
      created () {
        this.$store.dispatch('Order/LOAD', { params: { page: this.pagination.current_page } })
      }
    }
  </script>
  ```

## 用法

### 加载列表

  ```js
  this.$store.dispatch('Order/LOAD').then(items => {})
  ```

### 查询单个资源

  ```js
  this.$store.dispatch('Order/FIND', { id }).then(item => {})
  ```

### 创建

  ```js
  this.$store.dispatch('Order/CREATE', { payload }).then(item => {})
  ```

### 更新

  ```js
  // （建议）payload 仅包含需要变更的部分
  this.$store.dispatch('Order/UPDATE', { id, payload }).then(item => {})
  ```

### 删除

  ```js
  this.$store.dispatch('Order/DELETE', { id }).then(() => {})
  ```

### 使用getters

  > 注意，getters返回的是方法，需要执行这个方法才会返回数据

1. 数据

  ```js
  // 返回 FIND 的数据（默认参数是 CURRENT）
  return this.$store.getters['Order/item']()

  // 返回列表（默认参数是 ALL）
  return this.$store.getters['Order/items']()
  ```

2. 分页器

  ```js
  // 如果有分页器（默认参数是 ALL）
  return this.$store.getters['Order/pagination']()
  ```

3. 状态

  ```js
  // 返回 LOAD/LOAD_MORE 的状态（默认参数是 ALL）
  return this.$store.getters['Order/loading']()

  // 返回 FIND 的状态（默认参数是 CURRENT）
  return this.$store.getters['Order/finding']()

  // 返回 UPDATE/DELETE 的状态（默认参数是 CURRENT）
  return this.$store.getters['Order/submitting']()
  ```

### 使用state

  ```js
  this.$store.state.Order.items // 注意，items是一个Object
  ```

## 高级

### 资源路径带参数

举个例子，有时api的形式是获取某家商店下的所有产品，
```js
  export default builder('shops/:shop_id/orders?with=sale')
```

调用action的方式：
```js
  this.$store.dispatch('Order/LOAD', { params: {shop_id: 3} })
  // GET http(s)://your.domain.name/shops/3/orders?with=sale

  this.$store.dispatch('Order/LOAD_MORE', { params: {shop_id: 3, page: 2} })
  // GET http(s)://your.domain.name/shops/3/orders?with=sale&page=2

  this.$store.dispatch('Order/FIND', { id, params: {shop_id: 3} })
  // GET http(s)://your.domain.name/shops/3/orders/15?with=sale

  this.$store.dispatch('Order/CREATE', { payload, params: {shop_id: 3} })
  // POST http(s)://your.domain.name/shops/3/orders?with=sale

  // 需要到需插入节点
  this.$store.dispatch('Order/CREATE', { payload, params: {shop_id: 3}, mode: 'prepend' })

  this.$store.dispatch('Order/UPDATE', { id, payload, params: {shop_id: 3} })
  // PUT http(s)://your.domain.name/shops/3/orders/15?with=sale

  this.$store.dispatch('Order/DELETE', { id, params: {shop_id: 3} })
  // DELETE http(s)://your.domain.name/shops/3/orders/15?with=sale
```

### 缓存

1. 所有的数据是通的，举例说：
   你在导航栏里有某商家的一份产品分类列表，同时你在分类管理里面更新了某分类的名称，那么导航栏里的对应分类会自动更新；
   增加、删除分类同样会即时'同步'到导航栏上。

2. 有些场景下，列表可能会有许多个，~~列表与与列表之间可能存在交集，~~

> `LOAD`、`LOAD_MORE`、`CREATE`默认的cache是`ALL`  
> `FIND` 默认是`CURRENT`  
> `UPDATE`、`DELETE`会更新所有的cache.ids，但是它们的状态是在 `CURRENT` 下

```js
  // cache 只是用来区分列表的一个key，只要唯一就可以。可以是字符串也可以是数字，如
  this.$store.dispatch('Order/LOAD', { cache: 'shop_3', params: {shop_id: 3} })
  this.$store.dispatch('Order/LOAD', { cache: 3, params: {shop_id: 3} })

  this.$store.dispatch('Order/CREATE', { cache: 3, payload, params: {shop_id: 3} })

  this.$store.dispatch('Order/DELETE', { cache: 3, id, params: {shop_id: 3} })

  this.$store.getters['Order/items'](3)

  // 举个例子
  this.$store.dispatch('user/FIND', { cache: 'ownner', id })
  this.$store.dispatch('user/FIND', { cache: 'me', id })
  let ownner = this.$store.getters['Order/item']('ownner')
  let me = this.$store.getters['Order/item']('me')
```

3. 有时候需要强制拉取数据：使用 `refresh` 属性

```js
  // 如根据关键词搜索时
  this.$store.dispatch('Order/LOAD', { refresh: true, params: {keyword: 'xx'} })
  // 如重新获取单个对象
  this.$store.dispatch('Order/FIND', { refresh: true, id })
```


### 添加更多的 `actions`、`mutations`、`getters`
```js
  const module = builder('orders')

  function knock (id) {
    return Vue.http.put('api/endpoint', { id }).then(r => r.json())
  }

  module.actions.knock = ({ state, commit }, { id }) => {
    return knock(id)
  }

  export default module
```

另一种更加简单又强大的方式

```js
import builder from './builder'

const base = builder('user-attributes')

// http://tool.chinaz.com/tools/use
let colors = [
  '#FFCCCC', '#CCCCFF', '#99CC66', '#0066CC', '#CCCC00',
  '#99CCCC', '#0099CC', '#CC3333', '#CCCCCC', '#FFFF00',
  '#996699'
]

export default {
  ...base,

  state: {
    ...base.state,
    colors: {}
  },

  getters: {
    ...base.getters,
    color: (state) => (attributeId, tag) => {
      let attribute = state.items[attributeId]
      if (attribute.settings.options.indexOf(tag) === -1) {
        attribute.settings.options.push(tag)
      }
      return colors[attribute.settings.options.indexOf(tag)]
    }
  }
}

```


## roadmap

- 缓存到localStorage（有单独的过期时间），可以强制刷新  
- 解耦vue-resource




## 与同类插件的对比

- 2018-4-14

还发现另一个npm包：vuex-cache，但它的侧重点只在于请求本身的缓存。

- 2017年

在准备要发布npm的时候，发现一个类似的插件[vuex-rest-api](https://www.npmjs.com/package/vuex-rest-api)，
然后想要不要放弃，于是详细看了一下它的文档。主要的异同点：

1. vuex-rest-api需要自己添加actions，这个比较费代码

2. 没有对数据的缓存功能，有些数据会在很多地方使用，需要减少重复请求

基于以上2点，还是觉得要继续发布。唉，可惜了这个npm包名被占用了~（犹豫了一下，又不知道什么原因没有发布）
