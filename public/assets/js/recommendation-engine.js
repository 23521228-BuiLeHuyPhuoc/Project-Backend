(function(root,factory){
  const api=factory(root || {});
  if(typeof module==='object' && module.exports){
    module.exports=api;
  }
  if(root && root.document){
    root.TourRecommendationEngine=api.TourRecommendationEngine;
    const engine=new api.TourRecommendationEngine();
    root.tourRecommendationEngine=engine;

    const initialize=()=>{
      void engine.load();
      engine.bindSessionTracking(root.document);
      void engine.enhancePage(root.document);
    };
    if(root.document.readyState==='loading'){
      root.document.addEventListener('DOMContentLoaded',initialize,{once:true});
    }else{
      initialize();
    }
  }
})(typeof window!=='undefined' ? window : globalThis,function(root){
  'use strict';

  const featureNames=[
    'baseScore',
    'sessionAffinity',
    'outdoorMorning',
    'cityEvening',
    'shortMobile',
    'longDesktop',
    'popularityScore',
    'ratingScore'
  ];
  const defaultKernelWeights=[0.72,0.22,0.1,0.1,0.08,0.04,0.08,0.05];
  const sessionStorageKey='tourRecommendationSessionProfile';
  const interactionWeights={view:1,click:2,favorite:3,cart_add:3,purchase:5};
  const outdoorKeywords=[
    'bien','dao','nui','rung','trekking','leo nui','phieu luu',
    'outdoor','nature','sapa','sa pa','ha giang','da lat','phu quoc',
    'nha trang','ha long','moc chau'
  ];
  const cityKeywords=[
    'thanh pho','city','do thi','mua sam','ha noi','sai gon',
    'ho chi minh','da nang','hoi an','hue'
  ];

  const clamp01=value=>Math.min(1,Math.max(0,Number(value) || 0));

  const normalizeText=value=>String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[đĐ]/g,'d')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim();

  const parseDurationDays=value=>{
    if(Number.isFinite(Number(value)) && Number(value)>0){
      return Number(value);
    }
    const text=normalizeText(value);
    const dayMatch=text.match(/(\d+(?:\.\d+)?)\s*(?:n|ngay|day)/);
    if(dayMatch){
      return Number(dayMatch[1]);
    }
    const hourMatch=text.match(/(\d+(?:\.\d+)?)\s*(?:h|gio|hour)/);
    if(hourMatch){
      return Math.max(1,Math.ceil(Number(hourMatch[1])/24));
    }
    return 0;
  };

  const getTour= candidate=>candidate && candidate.tour
    ? candidate.tour
    : candidate || {};

  const inferTourTypes=candidate=>{
    const tour=getTour(candidate);
    const explicit=[
      ...(Array.isArray(candidate && candidate.tourTypes)
        ? candidate.tourTypes
        : []),
      ...(Array.isArray(tour.tourTypes) ? tour.tourTypes : [])
    ].map(normalizeText).filter(Boolean);
    const text=normalizeText([
      tour.name,
      tour.slug,
      tour.categoryName,
      tour.category,
      explicit.join(' ')
    ].filter(Boolean).join(' '));
    const types=new Set(explicit);
    if(outdoorKeywords.some(keyword=>text.includes(keyword))){
      types.add('outdoor');
    }
    if(cityKeywords.some(keyword=>text.includes(keyword))){
      types.add('city');
    }
    return types;
  };

  const detectDeviceType=()=>{
    const userAgent=root.navigator && root.navigator.userAgent || '';
    if(/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(userAgent)){
      return 'tablet';
    }
    if(/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i
      .test(userAgent)){
      return 'mobile';
    }
    return 'desktop';
  };

  const calculateSessionAffinity=(types,profile)=>{
    if(!profile || !profile.typeCounts || !types.size){
      return 0;
    }
    let matchedCount=0;
    types.forEach(type=>{
      matchedCount=Math.max(
        matchedCount,
        Number(profile.typeCounts[type]) || 0
      );
    });
    if(matchedCount>=3){
      return clamp01(0.5+(matchedCount-3)*0.15);
    }
    return clamp01(matchedCount/6);
  };

  const buildFeatureVector=(candidate,context={})=>{
    const tour=getTour(candidate);
    const types=inferTourTypes(candidate);
    const hour=Number.isInteger(context.hour)
      ? context.hour
      : new Date().getHours();
    const deviceType=context.deviceType || detectDeviceType();
    const durationDays=parseDurationDays(
      tour.durationDays || tour.time || candidate.durationDays
    );
    const isMorning=hour>=5 && hour<12;
    const isEvening=hour>=18 || hour<5;
    const isOutdoor=types.has('outdoor');
    const isCity=types.has('city');
    const popularity=Number(candidate
      && candidate.components
      && candidate.components.popularity);
    const rating=Number(tour.ratingAvg || candidate.ratingAvg || 0);

    return [
      clamp01(candidate && (candidate.serverScore ?? candidate.score)),
      calculateSessionAffinity(types,context.sessionProfile),
      isOutdoor && isMorning ? 1 : 0,
      isCity && isEvening ? 1 : 0,
      durationDays>0 && durationDays<=3 && deviceType==='mobile' ? 1 : 0,
      durationDays>=5 && deviceType==='desktop' ? 1 : 0,
      clamp01(Number.isFinite(popularity)
        ? popularity
        : candidate && candidate.popularityScore),
      clamp01(rating/5)
    ];
  };

  const scoreFeatureVector=(vector,weights=defaultKernelWeights,bias=0)=>
    clamp01(vector.reduce((total,value,index)=>
      total+(Number(weights[index]) || 0)*value,Number(bias) || 0));

  const formatCurrency=value=>new Intl.NumberFormat('vi-VN').format(
    Math.max(0,Number(value) || 0)
  );

  const formatDepartureDate=value=>{
    const date=new Date(value);
    if(Number.isNaN(date.getTime())){
      return 'Đang cập nhật';
    }
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    }).format(date);
  };

  const buildCardViewModel=(candidate,index=0)=>{
    const tour=getTour(candidate);
    const priceAdult=Math.max(0,Number(tour.priceAdult) || 0);
    const priceNewAdult=Math.max(0,Number(tour.priceNewAdult) || 0);
    const salePrice=priceNewAdult>0 ? priceNewAdult : priceAdult;
    const discount=priceAdult>0 && salePrice>0 && salePrice<priceAdult
      ? Math.round((priceAdult-salePrice)/priceAdult*100)
      : Math.max(0,Math.round(Number(tour.discount) || 0));
    const score=clamp01(candidate && candidate.score);
    return {
      tourId:String(candidate && candidate.tourId || tour._id || ''),
      requestId:String(candidate && candidate.recommendationRequestId || ''),
      position:index,
      name:String(tour.name || 'Tour du lịch'),
      link:tour.slug
        ? `/tour/detail/${encodeURIComponent(tour.slug)}?source=recommendation`
        : '#',
      avatar:String(tour.avatar || '/assets/images/product-1.jpg'),
      time:String(tour.time || 'Đang cập nhật'),
      departureDate:formatDepartureDate(tour.departureDate),
      priceAdult,
      salePrice,
      discount,
      stockAdult:Math.max(0,Number(tour.stockAdult) || 0),
      ratingAvg:Math.min(5,Math.max(0,Number(tour.ratingAvg) || 0)),
      ratingCount:Math.max(0,Number(tour.ratingCount) || 0),
      score,
      matchPercent:Math.round(score*100),
      components:{
        content:clamp01(candidate && candidate.components
          && candidate.components.content),
        collaborative:clamp01(candidate && candidate.components
          && candidate.components.collaborative),
        popularity:clamp01(candidate && candidate.components
          && candidate.components.popularity)
      }
    };
  };

  const createElement=(documentRef,tag,className,text)=>{
    const element=documentRef.createElement(tag);
    if(className){
      element.className=className;
    }
    if(text!==undefined){
      element.textContent=text;
    }
    return element;
  };

  const getSafeStorage=()=>{
    try{
      return root.sessionStorage || null;
    }catch(error){
      return null;
    }
  };

  const loadSessionProfile=storage=>{
    if(!storage){
      return {typeCounts:{},recentTourIds:[],total:0};
    }
    try{
      const parsed=JSON.parse(storage.getItem(sessionStorageKey));
      if(parsed && parsed.typeCounts && Array.isArray(parsed.recentTourIds)){
        return {
          typeCounts:{...parsed.typeCounts},
          recentTourIds:parsed.recentTourIds.slice(-20),
          total:Math.max(0,Number(parsed.total) || 0)
        };
      }
    }catch(error){
      // Ignore unavailable or malformed session storage.
    }
    return {typeCounts:{},recentTourIds:[],total:0};
  };

  class TourRecommendationEngine{
    constructor(options={}){
      this.modelUrl=options.modelUrl || '/api/recommendation/model';
      this.metadataUrl=options.metadataUrl || '/api/recommendation/metadata';
      this.fetch=options.fetch || (typeof root.fetch==='function'
        ? root.fetch.bind(root)
        : null);
      this.tf=Object.prototype.hasOwnProperty.call(options,'tf')
        ? options.tf
        : root.tf || null;
      this.storage=options.storage===undefined
        ? getSafeStorage()
        : options.storage;
      this.now=typeof options.now==='function' ? options.now : ()=>new Date();
      this.deviceType=options.deviceType || detectDeviceType();
      this.metadata={
        featureNames:[...featureNames],
        kernelWeights:[...defaultKernelWeights],
        bias:0
      };
      this.sessionProfile=loadSessionProfile(this.storage);
      this.model=options.model || null;
      this.loaded=Boolean(this.model);
      this.loadPromise=null;
      this.runtimeMode=this.model && this.tf
        ? 'tensorflow'
        : 'javascript-fallback';
      this.lastRuntimeError=null;
    }

    getRuntimeStatus(){
      let backend=null;
      if(this.tf && typeof this.tf.getBackend==='function'){
        try{
          backend=this.tf.getBackend() || null;
        }catch(error){
          backend=null;
        }
      }
      return {
        mode:this.runtimeMode,
        tensorflowAvailable:Boolean(
          this.tf && typeof this.tf.loadLayersModel==='function'
        ),
        modelLoaded:Boolean(this.model),
        backend,
        error:this.lastRuntimeError
      };
    }

    publishRuntimeStatus(){
      const status=this.getRuntimeStatus();
      if(root.document && root.document.documentElement){
        root.document.documentElement.dataset.recommendationRuntime=status.mode;
      }
      if(root.document && typeof root.CustomEvent==='function'){
        root.document.dispatchEvent(new root.CustomEvent(
          'recommendations:runtime',
          {detail:status}
        ));
      }
      return status;
    }

    useFallback(error){
      this.runtimeMode='javascript-fallback';
      this.lastRuntimeError=error && error.message
        ? error.message
        : String(error || 'TensorFlow.js runtime is unavailable.');
      if(root.document && root.console
        && typeof root.console.warn==='function'){
        root.console.warn(
          'TensorFlow.js recommendation inference is unavailable; using the JavaScript scorer.',
          error
        );
      }
      this.publishRuntimeStatus();
    }

    async load(){
      if(this.loaded){
        this.publishRuntimeStatus();
        return this;
      }
      if(this.loadPromise){
        return this.loadPromise;
      }
      this.loadPromise=(async()=>{
        if(this.fetch){
          try{
            const response=await this.fetch(this.metadataUrl,{
              credentials:'same-origin'
            });
            if(response.ok){
              const metadata=await response.json();
              if(Array.isArray(metadata.featureNames)
                && metadata.featureNames.length===featureNames.length){
                this.metadata={...this.metadata,...metadata};
              }
            }
          }catch(error){
            // The JavaScript fallback uses bundled metadata when offline.
          }
        }
        if(this.tf && typeof this.tf.loadLayersModel==='function'){
          try{
            if(typeof this.tf.ready==='function'){
              await this.tf.ready();
            }
            this.model=await this.tf.loadLayersModel(this.modelUrl);
            this.runtimeMode='tensorflow';
            this.lastRuntimeError=null;
          }catch(error){
            this.model=null;
            this.useFallback(error);
          }
        }else{
          this.useFallback(new Error('TensorFlow.js runtime is unavailable.'));
        }
        this.loaded=true;
        this.publishRuntimeStatus();
        return this;
      })().finally(()=>{
        this.loadPromise=null;
      });
      return this.loadPromise;
    }

    saveSessionProfile(){
      if(!this.storage){
        return;
      }
      try{
        this.storage.setItem(
          sessionStorageKey,
          JSON.stringify(this.sessionProfile)
        );
      }catch(error){
        // Session affinity remains available in memory.
      }
    }

    recordInteraction(candidate,type='view'){
      const tour=getTour(candidate);
      const tourId=String(candidate && candidate.tourId || tour._id || '');
      const weight=interactionWeights[type] || 1;
      inferTourTypes(candidate).forEach(tourType=>{
        this.sessionProfile.typeCounts[tourType]=
          (Number(this.sessionProfile.typeCounts[tourType]) || 0)+weight;
      });
      if(tourId){
        this.sessionProfile.recentTourIds=[
          ...this.sessionProfile.recentTourIds.filter(id=>id!==tourId),
          tourId
        ].slice(-20);
      }
      this.sessionProfile.total+=weight;
      this.saveSessionProfile();
      return this.sessionProfile;
    }

    createContext(options={}){
      const date=options.date instanceof Date ? options.date : this.now();
      return {
        hour:Number.isInteger(options.hour) ? options.hour : date.getHours(),
        deviceType:options.deviceType || this.deviceType,
        sessionProfile:options.sessionProfile || this.sessionProfile
      };
    }

    async predictVectors(vectors){
      if(!vectors.length){
        return [];
      }
      if(this.model && this.tf && typeof this.tf.tensor2d==='function'){
        let input;
        let output;
        try{
          input=this.tf.tensor2d(vectors,[vectors.length,featureNames.length]);
          const prediction=this.model.predict(input);
          output=Array.isArray(prediction) ? prediction[0] : prediction;
          const values=await output.data();
          if(values.length!==vectors.length){
            throw new Error('TensorFlow.js returned an unexpected output shape.');
          }
          this.runtimeMode='tensorflow';
          this.lastRuntimeError=null;
          return Array.from(values,clamp01);
        }catch(error){
          this.model=null;
          this.useFallback(error);
        }finally{
          if(input && typeof input.dispose==='function'){
            input.dispose();
          }
          if(output && typeof output.dispose==='function'){
            output.dispose();
          }
        }
      }
      const weights=Array.isArray(this.metadata.kernelWeights)
        ? this.metadata.kernelWeights
        : defaultKernelWeights;
      return vectors.map(vector=>scoreFeatureVector(
        vector,
        weights,
        this.metadata.bias
      ));
    }

    async rank(candidates,options={}){
      await this.load();
      const list=Array.isArray(candidates) ? candidates : [];
      const context=this.createContext(options);
      const vectors=list.map(candidate=>buildFeatureVector(candidate,context));
      const scores=await this.predictVectors(vectors);
      return list.map((candidate,index)=>({
        ...candidate,
        serverScore:clamp01(candidate.serverScore ?? candidate.score),
        score:Number(clamp01(scores[index]).toFixed(6)),
        contextFeatures:Object.fromEntries(featureNames.map((name,featureIndex)=>[
          name,
          vectors[index][featureIndex]
        ])),
        originalRank:index
      })).sort((first,second)=>
        second.score-first.score
        || second.serverScore-first.serverScore
        || first.originalRank-second.originalRank);
    }

    createTourCard(candidate,index,documentRef=root.document){
      if(!documentRef || typeof documentRef.createElement!=='function'){
        return null;
      }
      const view=buildCardViewModel(candidate,index);
      const card=createElement(
        documentRef,
        'article',
        'product-item recommendation-card'
      );
      card.style.animationDelay=`${Math.min(index,7)*55}ms`;
      card.dataset.tourCard='';
      card.dataset.tourId=view.tourId;
      card.dataset.tourName=view.name;
      card.dataset.tourDuration=view.time;
      card.dataset.recommendationTourId=view.tourId;
      card.dataset.recommendationRequestId=view.requestId;
      card.dataset.recommendationPosition=String(view.position);
      card.dataset.recommendationScore=String(view.score);
      card.dataset.recommendationContentScore=String(view.components.content);
      card.dataset.recommendationCollaborativeScore=String(
        view.components.collaborative
      );
      card.dataset.recommendationPopularityScore=String(
        view.components.popularity
      );
      card.dataset.recommendationFeedbackManaged='true';

      const media=createElement(documentRef,'div','inner-image recommendation-card-media');
      const imageLink=createElement(documentRef,'a');
      imageLink.href=view.link;
      const image=createElement(documentRef,'img');
      image.src=view.avatar;
      image.alt=view.name;
      image.loading='lazy';
      imageLink.appendChild(image);
      media.appendChild(imageLink);
      if(view.discount>0){
        const discount=createElement(
          documentRef,
          'span',
          'inner-discount',
          `Giảm -${view.discount}%`
        );
        media.appendChild(discount);
      }
      media.appendChild(createElement(
        documentRef,
        'span',
        'recommendation-match',
        `Điểm gợi ý ${view.matchPercent}/100`
      ));
      card.appendChild(media);

      const content=createElement(documentRef,'div','inner-content');
      const title=createElement(documentRef,'h3','inner-title');
      const titleLink=createElement(documentRef,'a',null,view.name);
      titleLink.href=view.link;
      title.appendChild(titleLink);
      content.appendChild(title);

      const prices=createElement(documentRef,'div','inner-prices');
      if(view.priceAdult>0 && view.salePrice<view.priceAdult){
        prices.appendChild(createElement(
          documentRef,
          'span',
          'inner-price-old',
          `${formatCurrency(view.priceAdult)} đ`
        ));
      }
      prices.appendChild(createElement(
        documentRef,
        'span',
        'inner-price-new',
        `${formatCurrency(view.salePrice)} đ`
      ));
      content.appendChild(prices);

      const description=createElement(documentRef,'div','inner-desc');
      const departure=createElement(
        documentRef,
        'div',
        'inner-desc-item',
        'Ngày khởi hành: '
      );
      departure.appendChild(createElement(
        documentRef,
        'b',
        null,
        view.departureDate
      ));
      const duration=createElement(
        documentRef,
        'div',
        'inner-desc-item',
        'Thời gian: '
      );
      duration.appendChild(createElement(documentRef,'b',null,view.time));
      description.append(departure,duration);
      content.appendChild(description);

      const meta=createElement(documentRef,'div','inner-meta');
      const rating=createElement(documentRef,'div','inner-rating');
      const stars=createElement(documentRef,'span','inner-stars');
      for(let star=1;star<=5;star+=1){
        stars.appendChild(createElement(
          documentRef,
          'i',
          star<=Math.round(view.ratingAvg)
            ? 'fa-solid fa-star'
            : 'fa-regular fa-star'
        ));
      }
      rating.append(stars,createElement(
        documentRef,
        'span',
        'inner-number',
        `(${view.ratingCount})`
      ));
      const stock=createElement(documentRef,'div','inner-stock');
      stock.append(
        createElement(documentRef,'span','inner-label','Số chỗ còn:'),
        createElement(documentRef,'span','inner-number',String(view.stockAdult))
      );
      meta.append(rating,stock);
      content.appendChild(meta);
      card.appendChild(content);
      return card;
    }

    renderSkeletons(container,count=4){
      if(!container || !root.document){
        return;
      }
      container.replaceChildren();
      for(let index=0;index<count;index+=1){
        const skeleton=createElement(
          root.document,
          'div',
          'recommendation-skeleton'
        );
        skeleton.append(
          createElement(root.document,'div','recommendation-skeleton-image'),
          createElement(root.document,'div','recommendation-skeleton-line is-short'),
          createElement(root.document,'div','recommendation-skeleton-line'),
          createElement(root.document,'div','recommendation-skeleton-line is-medium')
        );
        container.appendChild(skeleton);
      }
    }

    setSectionState(section,state,message=''){
      section.dataset.recommendationState=state;
      const container=section.querySelector('[data-recommendation-list]');
      const status=section.querySelector('[data-recommendation-status]');
      const statusMessage=section.querySelector(
        '[data-recommendation-status-message]'
      );
      if(container){
        container.setAttribute('aria-busy',state==='loading' ? 'true' : 'false');
      }
      if(status){
        status.hidden=state!=='error';
      }
      if(statusMessage && message){
        statusMessage.textContent=message;
      }
    }

    renderCandidates(container,candidates){
      if(!container || !root.document){
        return candidates;
      }
      const fragment=root.document.createDocumentFragment();
      candidates.forEach((candidate,index)=>{
        const card=this.createTourCard(candidate,index,root.document);
        if(card){
          fragment.appendChild(card);
        }
      });
      container.replaceChildren(fragment);
      return candidates;
    }

    rerankDom(container,rankedCandidates){
      if(!container || typeof container.querySelectorAll!=='function'){
        return rankedCandidates;
      }
      const nodes=new Map();
      container.querySelectorAll(
        '[data-recommendation-tour-id], [data-tour-card][data-tour-id]'
      ).forEach(node=>{
        const id=node.dataset.recommendationTourId || node.dataset.tourId;
        if(id && !nodes.has(id)){
          nodes.set(id,node);
        }
      });
      rankedCandidates.forEach(candidate=>{
        const id=String(candidate.tourId
          || candidate.tour && candidate.tour._id
          || '');
        const node=nodes.get(id);
        if(node){
          container.appendChild(node);
        }
      });
      if(typeof root.CustomEvent==='function'){
        container.dispatchEvent(new root.CustomEvent(
          'recommendations:ranked',
          {detail:{recommendations:rankedCandidates}}
        ));
      }
      return rankedCandidates;
    }

    async fetchCandidates(endpoint){
      if(!this.fetch){
        return [];
      }
      const response=await this.fetch(endpoint,{credentials:'same-origin'});
      if(!response.ok){
        throw new Error(`Recommendation request failed with ${response.status}`);
      }
      const payload=await response.json();
      if(Array.isArray(payload)){
        return payload;
      }
      const candidates=Array.isArray(payload.recommendations)
        ? payload.recommendations
        : payload.data && Array.isArray(payload.data.recommendations)
          ? payload.data.recommendations
          : Array.isArray(payload.data)
            ? payload.data
            : [];
      const requestId=payload.requestId
        || payload.data && payload.data.requestId
        || '';
      return requestId
        ? candidates.map(candidate=>({
          ...candidate,
          recommendationRequestId:requestId
        }))
        : candidates;
    }

    async enhanceSection(section){
      const endpoint=section && section.dataset
        && section.dataset.recommendationEndpoint;
      if(!endpoint){
        return [];
      }
      const container=section.querySelector('[data-recommendation-list]')
        || section;
      section.hidden=false;
      this.setSectionState(section,'loading');
      this.renderSkeletons(container);
      try{
        const candidates=await this.fetchCandidates(endpoint);
        const ranked=section.dataset.contextualRerank==='false'
          ? candidates
          : await this.rank(candidates);
        if(!ranked.length){
          section.hidden=true;
          return [];
        }
        this.renderCandidates(container,ranked);
        this.setSectionState(section,'ready');
        return ranked;
      }catch(error){
        container.replaceChildren();
        this.setSectionState(
          section,
          'error',
          'Chưa thể tải gợi ý lúc này.'
        );
        return [];
      }
    }

    async enhancePage(documentRoot){
      if(!documentRoot || typeof documentRoot.querySelectorAll!=='function'){
        return [];
      }
      const sections=[...documentRoot.querySelectorAll(
        '[data-recommendation-section][data-recommendation-endpoint]'
      )];
      const results=await Promise.allSettled(
        sections.map(section=>this.enhanceSection(section))
      );
      return results;
    }

    bindSessionTracking(documentRoot){
      if(!documentRoot || typeof documentRoot.addEventListener!=='function'){
        return;
      }
      documentRoot.addEventListener('click',event=>{
        const target=event.target;
        if(!target || typeof target.closest!=='function'){
          return;
        }
        const retry=target.closest('[data-recommendation-retry]');
        if(retry){
          const section=retry.closest('[data-recommendation-section]');
          if(section){
            void this.enhanceSection(section);
          }
          return;
        }
        const card=target.closest('[data-tour-card][data-tour-id]');
        if(!card){
          return;
        }
        const candidate={
          tourId:card.dataset.tourId,
          score:Number(card.dataset.recommendationScore) || 0,
          recommendationRequestId:card.dataset.recommendationRequestId || '',
          components:{
            content:Number(card.dataset.recommendationContentScore) || 0,
            collaborative:Number(
              card.dataset.recommendationCollaborativeScore
            ) || 0,
            popularity:Number(card.dataset.recommendationPopularityScore) || 0
          },
          tour:{
            _id:card.dataset.tourId,
            name:card.dataset.tourName,
            time:card.dataset.tourDuration,
            tourTypes:String(card.dataset.tourTypes || '')
              .split(',')
              .map(value=>value.trim())
              .filter(Boolean)
          }
        };
        this.recordInteraction(candidate,'click');
        if(card.dataset.recommendationFeedbackManaged==='true'){
          void this.sendFeedback(candidate,'click',{
            position:Number(card.dataset.recommendationPosition) || 0,
            source:card.closest('[data-recommendation-section]')
              ?.dataset.recommendationSource || 'recommendation',
            pagePath:`${root.location && root.location.pathname || ''}${
              root.location && root.location.search || ''
            }`
          });
        }
      });
    }

    async sendFeedback(candidate,action='click',options={}){
      if(!this.fetch || !candidate || !candidate.tourId){
        return false;
      }
      const eventId=root.crypto
        && typeof root.crypto.randomUUID==='function'
        ? root.crypto.randomUUID()
        : `feedback_${Date.now().toString(36)}_${Math.random()
          .toString(36).slice(2,14)}`;
      try{
        const response=await this.fetch('/api/recommendation/feedback',{
          method:'POST',
          headers:{
            'Content-Type':'application/json',
            'X-Device-Type':this.deviceType
          },
          credentials:'same-origin',
          keepalive:true,
          body:JSON.stringify({
            eventId,
            requestId:candidate.recommendationRequestId || '',
            tourId:String(candidate.tourId),
            action,
            position:Number(options.position) || 0,
            source:options.source || 'recommendation',
            pagePath:options.pagePath || '',
            occurredAt:new Date().toISOString(),
            scores:{
              final:clamp01(candidate.score),
              content:clamp01(candidate.components
                && candidate.components.content),
              collaborative:clamp01(candidate.components
                && candidate.components.collaborative),
              popularity:clamp01(candidate.components
                && candidate.components.popularity),
              contextual:clamp01(candidate.score)
            }
          })
        });
        return response.ok;
      }catch(error){
        return false;
      }
    }
  }

  return {
    TourRecommendationEngine,
    buildCardViewModel,
    buildFeatureVector,
    featureNames,
    inferTourTypes,
    parseDurationDays,
    scoreFeatureVector
  };
});
