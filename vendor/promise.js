;(function(){
  // Native extending
  // -------------------------
  Function.prototype.bind = Function.prototype.bind 
    || function(context, args){
      var self = this
      return function(){
        return self.apply(context, args.concat(slice.call(arguments)))
      }
    }
  // Local
  // -------------------------
  var 
    slice = Array.prototype.slice,
    isFunction = function(fn) {return typeof fn == "function"},
    typeOf = function(obj){
        return obj == null /*means null or undefined*/
        ? String(obj) : Object.prototype.toString.call(obj).slice(8, -1).toLowerCase();
    },
    extend = function(o1, o2){
      for(var i in o2){
        if(o2.hasOwnProperty(i)) o1[i] = o2[i]
      }
    },
    merge = function(o1, o2){
      for(var i in o2){
        if(!o2.hasOwnProperty(i)) continue
        if(typeOf(o1[i]) === "array" || typeOf(o2[i])==="array"){
          console.log(o1, o2)
          o1[i] = o1[i].concat(o2[i])
        }else{
          o1[i] = o2[i]
        }
      }
      return o1
    },

  // Class : Promise  
  // ------------------------
  states ={PENDING:1, RESOLVED:2, REJECTED:3 },
  Promise = function(){
    this.state = states.PENDING
    // LOCKED means waiting for queue ready
    this.locked = false;
    this.args = []
    this.doneCallbacks = []
    this.failCallbacks = []
    this.progressCallbacks = []
  }
  extend(Promise.prototype,{
    lock:function(){
      this.locked = true
      return this;
    },
    unlock:function(){
      this.locked = false;
      var method = {2:"resolve",3: "reject"}[this.state]
      if(method) this[method].apply(this, this.args)
      return this;
    },
    notify:function(){
      if(this.state !== states.PENDING) return this
      var fn,i = 0
      if(this.locked) return this
      while((fn = this.progressCallbacks[i++]) != null){
        fn.apply(this,arguments)
      }
      if(this.parent) this.parent.sub--
      return this;
    },
    reject:function(){
      if(this.state !== states.PENDING) return this
      var fn, args = this.args = slice.call(arguments)
      if(this.locked) return this;
      while((fn = this.failCallbacks.shift())!=null){
        fn.apply(this,arguments)
      }
      this.state = states.REJECTED
      return this;
    },
    resolve:function(){
      if(this.state !== states.PENDING) return this
      var fn, args = this.args = slice.call(arguments)
      if(this.locked) return this;
      while((fn = this.doneCallbacks.shift())!=null){
        fn.apply(this,arguments)
      }
      this.state = states.RESOLVED
      return this;
    },
    done:function(callback){
      if(!isFunction(callback)) return this
      if(!this._match(states.RESOLVED,callback)){
        this.doneCallbacks.push(callback.bind(this))
      }
      return this
    },
    fail:function(callback){
      if(!isFunction(callback)) return this
      if(!this._match(states.REJECTED,callback)){
        this.failCallbacks.push(callback.bind(this))
      }
      return this
    },
    progress:function(callback){
      if(!isFunction(callback)) return this
      this.progressCallbacks.push(callback)
      return this
    },
    always:function(callback){
      if(!isFunction(callback)) return this
      return this.done(callback).fail(callback)
    },
    then:function(doneCallback, failCallback, finCallback){
      if(!doneCallback){return this;}
      var promise = new Promise().lock();
      this.done(this._wraper(doneCallback,promise)).fail(failCallback).always(finCallback)
      return promise;
    },
    pipe:function(){
      return this
    },
    promise:function(){
      return this
    },
    // Private stuff
    // -------------------------
    _wraper:function(fn, promise){
      var self = this;
      return function(){
        var result = fn.apply(self,arguments)
        if(result instanceof Promise){
          extend(result, promise)
          result.unlock()
        }
        
      }
    },
    _match:function(state,callback){
      if(this.state == state){
        callback.apply(this, this.args)
        return true
      }
      return false
    }
  })
  extend(Promise, {
    when:function (){
      var promises = slice.call(arguments),
        whenPromise = new Promise();

      whenPromise.waiting= promises.length

      for(var i = 0, len = promises.length;i<len;i++){
        (function(i){
          promises[i].done(function(){
            // 不知道为什么jQuery默认when只接受第一个参数(如果第一个参数为Array)，照办吧。//TODO: fixed 参数
            whenPromise.args[i] = typeOf(promises[i].args[0]) == "array"?promises[i].args[0] : promises[i].args
            if(!--whenPromise.waiting) whenPromise.resolve.apply(whenPromise,whenPromise.args)
          })
          promises[i].fail(function(){
            whenPromise.reject(promises[i].args)
          })
        })(i)
      }
      return whenPromise
    },
    not: function(promise){
      var result =new Promise()
      promise
        .done(result.reject.bind(result))
        .fail(result.resolve.bind(result))
      return result
    },
    or: function(){
      var promises = slice.call(arguments),
        not = Promise.not,
        negatedPromises = promises.map(not);
      return Promise.not(Promise.when.apply(this, negatedPromises))
    }
  })
  window.Promise = Promise
})();
