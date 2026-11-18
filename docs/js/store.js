/* SJA — data ka store.
   LocalStore: sirf isi browser mein (localStorage). Firebase config na ho to yahi chalta hai.
   FirebaseStore: Firestore, offline cache ke saath — internet na ho to bhi kaam chalta hai, baad mein sync. */
(function(){
"use strict";

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function lsGet(k, d){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } }
function lsSet(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch(e){ return false; } }

/* ------------------------------ Local ------------------------------ */
function LocalStore(){ this.mode = "local"; this.key = "sja.db"; }
LocalStore.prototype._db = function(){ return lsGet(this.key, {}); };
LocalStore.prototype._save = function(db){
  if(!lsSet(this.key, db)) throw new Error("Browser ki storage bhar gayi — purana data backup kar ke saaf karein.");
};
LocalStore.prototype.list = function(col){
  var c = this._db()[col] || {};
  return Promise.resolve(Object.keys(c).map(function(id){ return Object.assign({ id:id }, c[id]); }));
};
LocalStore.prototype.get = function(col, id){
  var c = this._db()[col] || {};
  return Promise.resolve(c[id] ? Object.assign({ id:id }, c[id]) : null);
};
LocalStore.prototype.set = function(col, id, data){
  var db = this._db(); db[col] = db[col] || {};
  var d = clone(data); delete d.id; db[col][id] = d; this._save(db);
  return Promise.resolve();
};
LocalStore.prototype.del = function(col, id){
  var db = this._db(); if(db[col]) delete db[col][id]; this._save(db);
  return Promise.resolve();
};
LocalStore.prototype.nextNo = function(name, start){
  var db = this._db(); db.counters = db.counters || {};
  var n = Math.max(Number((db.counters[name] || {}).next) || 0, start || 1);
  db.counters[name] = { next: n + 1 }; this._save(db);
  return Promise.resolve(n);
};
LocalStore.prototype.exportAll = function(){ return Promise.resolve(this._db()); };
LocalStore.prototype.importAll = function(db){ this._save(db); return Promise.resolve(); };

/* ----------------------------- Firebase ----------------------------- */
function FirebaseStore(db){ this.mode = "firebase"; this.db = db; }
function withTimeout(p, ms){
  return Promise.race([p, new Promise(function(res){ setTimeout(function(){ res("queued"); }, ms); })]);
}
FirebaseStore.prototype.list = function(col){
  var ref = this.db.collection(col);
  var p = navigator.onLine ? ref.get().catch(function(){ return ref.get({ source:"cache" }); }) : ref.get({ source:"cache" });
  return p.then(function(s){ return s.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); }); });
};
FirebaseStore.prototype.get = function(col, id){
  var ref = this.db.collection(col).doc(id);
  var p = navigator.onLine ? ref.get().catch(function(){ return ref.get({ source:"cache" }); }) : ref.get({ source:"cache" });
  return p.then(function(d){ return d.exists ? Object.assign({ id:d.id }, d.data()) : null; }).catch(function(){ return null; });
};
// Offline mein Firestore ka promise internet aane tak ruka rehta hai — 2.5s baad aage barh jao, sync khud hoga
FirebaseStore.prototype.set = function(col, id, data){
  var d = clone(data); delete d.id;
  return withTimeout(this.db.collection(col).doc(id).set(d), 2500);
};
FirebaseStore.prototype.del = function(col, id){ return withTimeout(this.db.collection(col).doc(id).delete(), 2500); };
FirebaseStore.prototype.nextNo = function(name, start){
  var db = this.db, ref = db.collection("counters").doc(name), localKey = "sja.next." + name;
  if(!navigator.onLine){
    // offline: local counter se number — online hote hi server counter aage kar dete hain
    var n = Math.max(lsGet(localKey, 0), start || 1); lsSet(localKey, n + 1);
    withTimeout(ref.set({ next: n + 1 }, { merge:true }), 100);
    return Promise.resolve(n);
  }
  return db.runTransaction(function(tx){
    return tx.get(ref).then(function(d){
      var n = Math.max(Number(d.exists && d.data().next) || 0, lsGet(localKey, 0), start || 1);
      tx.set(ref, { next: n + 1 });
      return n;
    });
  }).then(function(n){ lsSet(localKey, n + 1); return n; });
};
// Live: server / doosre device par tabdeeli hote hi cb(rows) — offline mein cache se
FirebaseStore.prototype.watch = function(col, cb){
  return this.db.collection(col).onSnapshot(function(s){
    cb(s.docs.map(function(d){ return Object.assign({ id:d.id }, d.data()); }));
  }, function(err){ console.warn("watch " + col, err && err.code); });
};
FirebaseStore.prototype.watchDoc = function(col, id, cb){
  return this.db.collection(col).doc(id).onSnapshot(function(d){ cb(d.exists ? Object.assign({ id:d.id }, d.data()) : null); },
    function(err){ console.warn("watch " + col + "/" + id, err && err.code); });
};
FirebaseStore.prototype.exportAll = function(){
  var self = this, cols = ["parties", "items", "bills", "payments", "settings", "counters"], out = {};
  return Promise.all(cols.map(function(c){
    return self.list(c).then(function(rows){ out[c] = {}; rows.forEach(function(r){ var id = r.id; delete r.id; out[c][id] = r; }); });
  })).then(function(){ return out; });
};

window.SjaStore = { LocalStore:LocalStore, FirebaseStore:FirebaseStore, lsGet:lsGet, lsSet:lsSet };
})();
