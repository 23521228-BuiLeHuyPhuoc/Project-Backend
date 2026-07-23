(()=>{
  'use strict';

  const endpoint='/api/tracking/events';
  const storageKey='tourTrackingSessionId';
  const sessionCookie='trackingSessionId';
  const flushInterval=30000;
  const hoverThreshold=1200;
  const tokenPattern=/^[A-Za-z0-9_-]{16,100}$/;
  const allowedSources=new Set([
    'home',
    'category',
    'search',
    'recommendation',
    'favorite',
    'direct'
  ]);
  const body=document.body;

  if(!body){
    return;
  }

  const createToken=prefix=>{
    if(window.crypto && typeof window.crypto.randomUUID==='function'){
      return window.crypto.randomUUID();
    }
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,14)}`;
  };

  const getStoredSessionId=()=>{
    try{
      return localStorage.getItem(storageKey) || '';
    }
    catch(error){
      return '';
    }
  };

  const serverSessionId=String(body.dataset.trackingSessionId || '').trim();
  const storedSessionId=String(getStoredSessionId()).trim();
  const sessionId=tokenPattern.test(storedSessionId)
    ? storedSessionId
    : tokenPattern.test(serverSessionId)
      ? serverSessionId
      : createToken('session');

  try{
    localStorage.setItem(storageKey,sessionId);
  }
  catch(error){
    // The in-memory session ID still works when storage is unavailable.
  }

  const secureCookie=window.location.protocol==='https:' ? '; Secure' : '';
  document.cookie=`${sessionCookie}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=31536000; SameSite=Lax${secureCookie}`;

  const getDeviceType=()=>{
    const userAgent=navigator.userAgent || '';
    if(/ipad|tablet|playbook|silk|android(?!.*mobile)/i.test(userAgent)){
      return 'tablet';
    }
    if(/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(userAgent)){
      return 'mobile';
    }
    return 'desktop';
  };

  const getPageSource=()=>{
    const explicitSource=new URLSearchParams(window.location.search).get('source');
    if(allowedSources.has(explicitSource)){
      return explicitSource;
    }

    try{
      const referer=new URL(document.referrer);
      if(referer.origin===window.location.origin){
        if(referer.pathname==='/'){
          return 'home';
        }
        if(referer.pathname.startsWith('/category')){
          return 'category';
        }
        if(referer.pathname.startsWith('/search')){
          return 'search';
        }
        if(referer.pathname.startsWith('/account/favorites')){
          return 'favorite';
        }
      }
    }
    catch(error){
      return 'direct';
    }

    return 'direct';
  };

  const getCurrentSurface=()=>{
    const path=window.location.pathname;
    if(path==='/'){
      return 'home';
    }
    if(path.startsWith('/category')){
      return 'category';
    }
    if(path.startsWith('/search')){
      return 'search';
    }
    if(path.startsWith('/account/favorites')){
      return 'favorite';
    }
    return 'direct';
  };

  const deviceType=getDeviceType();
  const pageSource=getPageSource();
  const currentSurface=getCurrentSurface();
  const pagePath=`${window.location.pathname}${window.location.search}`.slice(0,500);
  let pendingEvents=[];
  let sending=false;

  const queueEvent=event=>{
    pendingEvents.push({
      eventId:createToken('event'),
      occurredAt:new Date().toISOString(),
      ...event
    });
    if(pendingEvents.length>=40){
      void flushEvents();
    }
  };

  const flushEvents=async({useBeacon=false}={})=>{
    if(!pendingEvents.length || (sending && !useBeacon)){
      return;
    }

    const events=pendingEvents.splice(0,50);
    const payload=JSON.stringify({sessionId,events});

    if(useBeacon && typeof navigator.sendBeacon==='function'){
      const sent=navigator.sendBeacon(
        endpoint,
        new Blob([payload],{type:'application/json'})
      );
      if(sent){
        return;
      }
    }

    sending=true;
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:payload,
        keepalive:useBeacon,
        credentials:'same-origin'
      });
      if(!response.ok && response.status>=500){
        throw new Error(`Tracking request failed with ${response.status}`);
      }
    }
    catch(error){
      pendingEvents=[...events,...pendingEvents].slice(0,100);
    }
    finally{
      sending=false;
    }
  };

  const detailRoot=document.querySelector(
    '[data-behavior-page="tour-detail"][data-tour-id]'
  );
  const detailState=detailRoot ? {
    tourId:detailRoot.dataset.tourId,
    activeMilliseconds:0,
    visibleStartedAt:document.visibilityState==='visible' ? performance.now() : null,
    maxScrollDepth:0,
    clickEvents:new Set(),
    reviewViewed:false
  } : null;

  const pauseDetailTimer=()=>{
    if(!detailState || detailState.visibleStartedAt===null){
      return;
    }
    detailState.activeMilliseconds+=performance.now()-detailState.visibleStartedAt;
    detailState.visibleStartedAt=null;
  };

  const resumeDetailTimer=()=>{
    if(detailState && detailState.visibleStartedAt===null && document.visibilityState==='visible'){
      detailState.visibleStartedAt=performance.now();
    }
  };

  const updateScrollDepth=()=>{
    if(!detailState){
      return;
    }
    const documentHeight=Math.max(
      document.documentElement.scrollHeight,
      body.scrollHeight,
      window.innerHeight
    );
    const depth=Math.min(
      100,
      ((window.scrollY+window.innerHeight)/documentHeight)*100
    );
    detailState.maxScrollDepth=Math.max(detailState.maxScrollDepth,depth);
  };

  const queueDetailSummary=()=>{
    if(!detailState){
      return;
    }

    pauseDetailTimer();
    updateScrollDepth();
    const viewDuration=Math.round(detailState.activeMilliseconds/100)/10;
    const clickEvents=[...detailState.clickEvents];

    if(viewDuration>=0.5 || clickEvents.length || detailState.reviewViewed){
      queueEvent({
        type:'view',
        tourId:detailState.tourId,
        value:viewDuration,
        metadata:{
          interactionKind:'detail_engagement',
          viewDuration,
          scrollDepth:Math.round(detailState.maxScrollDepth),
          reviewViewed:detailState.reviewViewed,
          clickEvents,
          pagePath,
          source:pageSource,
          deviceType
        }
      });
    }

    detailState.activeMilliseconds=0;
    detailState.clickEvents.clear();
    resumeDetailTimer();
  };

  if(detailState){
    let scrollScheduled=false;
    updateScrollDepth();
    window.addEventListener('scroll',()=>{
      if(scrollScheduled){
        return;
      }
      scrollScheduled=true;
      window.requestAnimationFrame(()=>{
        updateScrollDepth();
        scrollScheduled=false;
      });
    },{passive:true});

    document.addEventListener('click',event=>{
      const target=event.target;
      if(!(target instanceof Element)){
        return;
      }
      if(target.closest('[data-favorite-toggle]')){
        detailState.clickEvents.add('favorite');
      }
      if(target.closest('.inner-button-add-cart')){
        detailState.clickEvents.add('cart_add');
      }
      if(target.closest('.inner-read-more button')){
        detailState.clickEvents.add('read_more');
      }
      if(target.closest('.box-tour-schedule')){
        detailState.clickEvents.add('schedule');
      }
      if(target.closest('.box-images')){
        detailState.clickEvents.add('gallery');
      }
      if(target.closest('[data-review-section]')){
        detailState.clickEvents.add('review_section');
        detailState.reviewViewed=true;
      }
    });

    const reviewSection=document.querySelector('[data-review-section]');
    if(reviewSection && 'IntersectionObserver' in window){
      let reviewTimer=null;
      const observer=new IntersectionObserver(entries=>{
        const visible=entries.some(entry=>entry.isIntersecting && entry.intersectionRatio>=0.35);
        if(visible && !detailState.reviewViewed && !reviewTimer){
          reviewTimer=window.setTimeout(()=>{
            detailState.reviewViewed=true;
            detailState.clickEvents.add('review_section');
            reviewTimer=null;
          },1000);
        }
        else if(!visible && reviewTimer){
          window.clearTimeout(reviewTimer);
          reviewTimer=null;
        }
      },{threshold:[0.35]});
      observer.observe(reviewSection);
    }
  }

  if(!window.matchMedia || window.matchMedia('(hover: hover)').matches){
    const hoveredTours=new Set();
    document.querySelectorAll('[data-tour-card][data-tour-id]').forEach(card=>{
      let hoverStartedAt=0;
      card.addEventListener('pointerenter',()=>{
        hoverStartedAt=performance.now();
      });
      card.addEventListener('pointerleave',()=>{
        if(!hoverStartedAt){
          return;
        }
        const tourId=card.dataset.tourId;
        const hoverDuration=Math.round(performance.now()-hoverStartedAt);
        hoverStartedAt=0;
        if(!tourId || hoverDuration<hoverThreshold || hoveredTours.has(tourId)){
          return;
        }
        hoveredTours.add(tourId);
        queueEvent({
          type:'view',
          tourId,
          value:1,
          metadata:{
            interactionKind:'hover',
            hoverDuration,
            pagePath,
            source:currentSurface,
            deviceType
          }
        });
      });
    });
  }

  document.addEventListener('click',event=>{
    const target=event.target;
    if(!(target instanceof Element)){
      return;
    }

    const directTarget=target.closest('[data-recommendation-tour-id]');
    const recommendationSection=target.closest('[data-recommendation-section]');
    const tourCard=recommendationSection
      ? target.closest('[data-tour-card][data-tour-id]')
      : null;
    const tourId=directTarget
      ? directTarget.dataset.recommendationTourId
      : tourCard && tourCard.dataset.tourId;

    if(!tourId){
      return;
    }

    queueEvent({
      type:'click_recommendation',
      tourId,
      value:2.5,
      metadata:{
        interactionKind:'recommendation_click',
        pagePath,
        source:'recommendation',
        deviceType
      }
    });
    void flushEvents({useBeacon:true});
  });

  window.setInterval(()=>{
    queueDetailSummary();
    void flushEvents();
  },flushInterval);

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'){
      queueDetailSummary();
      void flushEvents({useBeacon:true});
    }
    else{
      resumeDetailTimer();
    }
  });

  let pageEnding=false;
  const flushBeforeLeaving=()=>{
    if(pageEnding){
      return;
    }
    pageEnding=true;
    queueDetailSummary();
    void flushEvents({useBeacon:true});
  };

  window.addEventListener('pagehide',flushBeforeLeaving);
  window.addEventListener('beforeunload',flushBeforeLeaving);
})();
