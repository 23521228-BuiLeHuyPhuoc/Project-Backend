const createResponse=()=>({
  statusCode:200,
  body:undefined,
  redirectUrl:undefined,
  rendered:undefined,
  cookies:[],
  clearedCookies:[],
  locals:{},
  status(code){
    this.statusCode=code;
    return this;
  },
  json(payload){
    this.body=payload;
    return this;
  },
  send(payload){
    this.body=payload;
    return this;
  },
  redirect(url){
    this.redirectUrl=url;
    return this;
  },
  render(view,data){
    this.rendered={view,data};
    return this;
  },
  cookie(name,value,options){
    this.cookies.push({name,value,options});
    return this;
  },
  clearCookie(name){
    this.clearedCookies.push(name);
    return this;
  }
});

const createRequest=overrides=>({
  body:{},
  params:{},
  query:{},
  cookies:{},
  headers:{},
  method:'GET',
  originalUrl:'/',
  path:'/',
  permissions:[],
  get(name){
    return this.headers[String(name).toLowerCase()];
  },
  accepts(){
    return 'html';
  },
  flash(){},
  ...overrides
});

const stub=(target,key,replacement,restores)=>{
  const original=target[key];
  target[key]=replacement;
  restores.push(()=>{
    target[key]=original;
  });
};

const restoreAll=restores=>{
  while(restores.length){
    restores.pop()();
  }
};

module.exports={createRequest,createResponse,restoreAll,stub};
