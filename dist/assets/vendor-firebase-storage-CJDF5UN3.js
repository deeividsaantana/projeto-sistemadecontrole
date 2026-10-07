import{F as $e,g as E,_ as ze,a as je,b as Xe,i as ge,p as Ge,c as We,d as Ve,e as Ke,C as Ye,r as ce,S as Ze}from"./vendor-firebase-dx2a1frb.js";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const be="firebasestorage.googleapis.com",Re="storageBucket",Je=120*1e3,Qe=600*1e3,et=1e3;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class d extends $e{constructor(e,n,s=0){super(Z(e),`Firebase Storage: ${n} (${Z(e)})`),this.status_=s,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,d.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return Z(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var h;(function(t){t.UNKNOWN="unknown",t.OBJECT_NOT_FOUND="object-not-found",t.BUCKET_NOT_FOUND="bucket-not-found",t.PROJECT_NOT_FOUND="project-not-found",t.QUOTA_EXCEEDED="quota-exceeded",t.UNAUTHENTICATED="unauthenticated",t.UNAUTHORIZED="unauthorized",t.UNAUTHORIZED_APP="unauthorized-app",t.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",t.INVALID_CHECKSUM="invalid-checksum",t.CANCELED="canceled",t.INVALID_EVENT_NAME="invalid-event-name",t.INVALID_URL="invalid-url",t.INVALID_DEFAULT_BUCKET="invalid-default-bucket",t.NO_DEFAULT_BUCKET="no-default-bucket",t.CANNOT_SLICE_BLOB="cannot-slice-blob",t.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",t.NO_DOWNLOAD_URL="no-download-url",t.INVALID_ARGUMENT="invalid-argument",t.INVALID_ARGUMENT_COUNT="invalid-argument-count",t.APP_DELETED="app-deleted",t.INVALID_ROOT_OPERATION="invalid-root-operation",t.INVALID_FORMAT="invalid-format",t.INTERNAL_ERROR="internal-error",t.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(h||(h={}));function Z(t){return"storage/"+t}function ne(){const t="An unknown error occurred, please check the error payload for server response.";return new d(h.UNKNOWN,t)}function tt(t){return new d(h.OBJECT_NOT_FOUND,"Object '"+t+"' does not exist.")}function nt(t){return new d(h.QUOTA_EXCEEDED,"Quota for bucket '"+t+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function st(){const t="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new d(h.UNAUTHENTICATED,t)}function rt(){return new d(h.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function ot(t){return new d(h.UNAUTHORIZED,"User does not have permission to access '"+t+"'.")}function Te(){return new d(h.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function ke(){return new d(h.CANCELED,"User canceled the upload/download.")}function it(t){return new d(h.INVALID_URL,"Invalid URL '"+t+"'.")}function at(t){return new d(h.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+t+"'.")}function ut(){return new d(h.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+Re+"' property when initializing the app?")}function we(){return new d(h.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function ct(){return new d(h.SERVER_FILE_WRONG_SIZE,"Server recorded incorrect upload file size, please retry the upload.")}function lt(){return new d(h.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function ht(t){return new d(h.UNSUPPORTED_ENVIRONMENT,`${t} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function ee(t){return new d(h.INVALID_ARGUMENT,t)}function ye(){return new d(h.APP_DELETED,"The Firebase app was deleted.")}function dt(t){return new d(h.INVALID_ROOT_OPERATION,"The operation '"+t+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function H(t,e){return new d(h.INVALID_FORMAT,"String does not match format '"+t+"': "+e)}function F(t){throw new d(h.INTERNAL_ERROR,"Internal error: "+t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class k{constructor(e,n){this.bucket=e,this.path_=n}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,n){let s;try{s=k.makeFromUrl(e,n)}catch{return new k(e,"")}if(s.path==="")return s;throw at(e)}static makeFromUrl(e,n){let s=null;const r="([A-Za-z0-9.\\-_]+)";function o(b){b.path.charAt(b.path.length-1)==="/"&&(b.path_=b.path_.slice(0,-1))}const i="(/(.*))?$",u=new RegExp("^gs://"+r+i,"i"),a={bucket:1,path:3};function l(b){b.path_=decodeURIComponent(b.path)}const c="v[A-Za-z0-9_]+",f=n.replace(/[.]/g,"\\."),p="(/([^?#]*).*)?$",m=new RegExp(`^https?://${f}/${c}/b/${r}/o${p}`,"i"),g={bucket:1,path:3},w=n===be?"(?:storage.googleapis.com|storage.cloud.google.com)":n,_="([^?#]*)",I=new RegExp(`^https?://${w}/${r}/${_}`,"i"),R=[{regex:u,indices:a,postModify:o},{regex:m,indices:g,postModify:l},{regex:I,indices:{bucket:1,path:2},postModify:l}];for(let b=0;b<R.length;b++){const D=R[b],L=D.regex.exec(e);if(L){const K=L[D.indices.bucket];let M=L[D.indices.path];M||(M=""),s=new k(K,M),D.postModify(s);break}}if(s==null)throw it(e);return s}}class ft{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _t(t,e,n){let s=1,r=null,o=null,i=!1,u=0;function a(){return u===2}let l=!1;function c(..._){l||(l=!0,e.apply(null,_))}function f(_){r=setTimeout(()=>{r=null,t(m,a())},_)}function p(){o&&clearTimeout(o)}function m(_,...I){if(l){p();return}if(_){p(),c.call(null,_,...I);return}if(a()||i){p(),c.call(null,_,...I);return}s<64&&(s*=2);let R;u===1?(u=2,R=0):R=(s+Math.random())*1e3,f(R)}let g=!1;function w(_){g||(g=!0,p(),!l&&(r!==null?(_||(u=2),clearTimeout(r),f(0)):_||(u=1)))}return f(0),o=setTimeout(()=>{i=!0,w(!0)},n),w}function pt(t){t(!1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function mt(t){return t!==void 0}function gt(t){return typeof t=="function"}function bt(t){return typeof t=="object"&&!Array.isArray(t)}function W(t){return typeof t=="string"||t instanceof String}function le(t){return se()&&t instanceof Blob}function se(){return typeof Blob<"u"}function te(t,e,n,s){if(s<e)throw ee(`Invalid value for '${t}'. Expected ${e} or greater.`);if(s>n)throw ee(`Invalid value for '${t}'. Expected ${n} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function x(t,e,n){let s=e;return n==null&&(s=`https://${e}`),`${n}://${s}/v0${t}`}function Ee(t){const e=encodeURIComponent;let n="?";for(const s in t)if(t.hasOwnProperty(s)){const r=e(s)+"="+e(t[s]);n=n+r+"&"}return n=n.slice(0,-1),n}var N;(function(t){t[t.NO_ERROR=0]="NO_ERROR",t[t.NETWORK_ERROR=1]="NETWORK_ERROR",t[t.ABORT=2]="ABORT"})(N||(N={}));/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ue(t,e){const n=t>=500&&t<600,r=[408,429].indexOf(t)!==-1,o=e.indexOf(t)!==-1;return n||r||o}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rt{constructor(e,n,s,r,o,i,u,a,l,c,f,p=!0,m=!1){this.url_=e,this.method_=n,this.headers_=s,this.body_=r,this.successCodes_=o,this.additionalRetryCodes_=i,this.callback_=u,this.errorCallback_=a,this.timeout_=l,this.progressCallback_=c,this.connectionFactory_=f,this.retry=p,this.isUsingEmulator=m,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((g,w)=>{this.resolve_=g,this.reject_=w,this.start_()})}start_(){const e=(s,r)=>{if(r){s(!1,new j(!1,null,!0));return}const o=this.connectionFactory_();this.pendingConnection_=o;const i=u=>{const a=u.loaded,l=u.lengthComputable?u.total:-1;this.progressCallback_!==null&&this.progressCallback_(a,l)};this.progressCallback_!==null&&o.addUploadProgressListener(i),o.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&o.removeUploadProgressListener(i),this.pendingConnection_=null;const u=o.getErrorCode()===N.NO_ERROR,a=o.getStatus();if(!u||Ue(a,this.additionalRetryCodes_)&&this.retry){const c=o.getErrorCode()===N.ABORT;s(!1,new j(!1,null,c));return}const l=this.successCodes_.indexOf(a)!==-1;s(!0,new j(l,o))})},n=(s,r)=>{const o=this.resolve_,i=this.reject_,u=r.connection;if(r.wasSuccessCode)try{const a=this.callback_(u,u.getResponse());mt(a)?o(a):o()}catch(a){i(a)}else if(u!==null){const a=ne();a.serverResponse=u.getErrorText(),this.errorCallback_?i(this.errorCallback_(u,a)):i(a)}else if(r.canceled){const a=this.appDelete_?ye():ke();i(a)}else{const a=Te();i(a)}};this.canceled_?n(!1,new j(!1,null,!0)):this.backoffId_=_t(e,n,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,this.backoffId_!==null&&pt(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class j{constructor(e,n,s){this.wasSuccessCode=e,this.connection=n,this.canceled=!!s}}function Tt(t,e){e!==null&&e.length>0&&(t.Authorization="Firebase "+e)}function kt(t,e){t["X-Firebase-Storage-Version"]="webjs/"+(e??"AppManager")}function wt(t,e){e&&(t["X-Firebase-GMPID"]=e)}function yt(t,e){e!==null&&(t["X-Firebase-AppCheck"]=e)}function Et(t,e,n,s,r,o,i=!0,u=!1){const a=Ee(t.urlParams),l=t.url+a,c=Object.assign({},t.headers);return wt(c,e),Tt(c,n),kt(c,o),yt(c,s),new Rt(l,t.method,c,t.body,t.successCodes,t.additionalRetryCodes,t.handler,t.errorHandler,t.timeout,t.progressCallback,r,i,u)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ut(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function At(...t){const e=Ut();if(e!==void 0){const n=new e;for(let s=0;s<t.length;s++)n.append(t[s]);return n.getBlob()}else{if(se())return new Blob(t);throw new d(h.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function St(t,e,n){return t.webkitSlice?t.webkitSlice(e,n):t.mozSlice?t.mozSlice(e,n):t.slice?t.slice(e,n):null}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ot(t){if(typeof atob>"u")throw ht("base-64");return atob(t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const A={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class J{constructor(e,n){this.data=e,this.contentType=n||null}}function Ae(t,e){switch(t){case A.RAW:return new J(Se(e));case A.BASE64:case A.BASE64URL:return new J(Oe(t,e));case A.DATA_URL:return new J(Ct(e),Pt(e))}throw ne()}function Se(t){const e=[];for(let n=0;n<t.length;n++){let s=t.charCodeAt(n);if(s<=127)e.push(s);else if(s<=2047)e.push(192|s>>6,128|s&63);else if((s&64512)===55296)if(!(n<t.length-1&&(t.charCodeAt(n+1)&64512)===56320))e.push(239,191,189);else{const o=s,i=t.charCodeAt(++n);s=65536|(o&1023)<<10|i&1023,e.push(240|s>>18,128|s>>12&63,128|s>>6&63,128|s&63)}else(s&64512)===56320?e.push(239,191,189):e.push(224|s>>12,128|s>>6&63,128|s&63)}return new Uint8Array(e)}function It(t){let e;try{e=decodeURIComponent(t)}catch{throw H(A.DATA_URL,"Malformed data URL.")}return Se(e)}function Oe(t,e){switch(t){case A.BASE64:{const r=e.indexOf("-")!==-1,o=e.indexOf("_")!==-1;if(r||o)throw H(t,"Invalid character '"+(r?"-":"_")+"' found: is it base64url encoded?");break}case A.BASE64URL:{const r=e.indexOf("+")!==-1,o=e.indexOf("/")!==-1;if(r||o)throw H(t,"Invalid character '"+(r?"+":"/")+"' found: is it base64 encoded?");e=e.replace(/-/g,"+").replace(/_/g,"/");break}}let n;try{n=Ot(e)}catch(r){throw r.message.includes("polyfill")?r:H(t,"Invalid character found")}const s=new Uint8Array(n.length);for(let r=0;r<n.length;r++)s[r]=n.charCodeAt(r);return s}class Ie{constructor(e){this.base64=!1,this.contentType=null;const n=e.match(/^data:([^,]+)?,/);if(n===null)throw H(A.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const s=n[1]||null;s!=null&&(this.base64=xt(s,";base64"),this.contentType=this.base64?s.substring(0,s.length-7):s),this.rest=e.substring(e.indexOf(",")+1)}}function Ct(t){const e=new Ie(t);return e.base64?Oe(A.BASE64,e.rest):It(e.rest)}function Pt(t){return new Ie(t).contentType}function xt(t,e){return t.length>=e.length?t.substring(t.length-e.length)===e:!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class P{constructor(e,n){let s=0,r="";le(e)?(this.data_=e,s=e.size,r=e.type):e instanceof ArrayBuffer?(n?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),s=this.data_.length):e instanceof Uint8Array&&(n?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),s=e.length),this.size_=s,this.type_=r}size(){return this.size_}type(){return this.type_}slice(e,n){if(le(this.data_)){const s=this.data_,r=St(s,e,n);return r===null?null:new P(r)}else{const s=new Uint8Array(this.data_.buffer,e,n-e);return new P(s,!0)}}static getBlob(...e){if(se()){const n=e.map(s=>s instanceof P?s.data_:s);return new P(At.apply(null,n))}else{const n=e.map(i=>W(i)?Ae(A.RAW,i).data:i.data_);let s=0;n.forEach(i=>{s+=i.byteLength});const r=new Uint8Array(s);let o=0;return n.forEach(i=>{for(let u=0;u<i.length;u++)r[o++]=i[u]}),new P(r,!0)}}uploadData(){return this.data_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function re(t){let e;try{e=JSON.parse(t)}catch{return null}return bt(e)?e:null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Nt(t){if(t.length===0)return null;const e=t.lastIndexOf("/");return e===-1?"":t.slice(0,e)}function vt(t,e){const n=e.split("/").filter(s=>s.length>0).join("/");return t.length===0?n:t+"/"+n}function Ce(t){const e=t.lastIndexOf("/",t.length-2);return e===-1?t:t.slice(e+1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dt(t,e){return e}class T{constructor(e,n,s,r){this.server=e,this.local=n||e,this.writable=!!s,this.xform=r||Dt}}let X=null;function Lt(t){return!W(t)||t.length<2?t:Ce(t)}function $(){if(X)return X;const t=[];t.push(new T("bucket")),t.push(new T("generation")),t.push(new T("metageneration")),t.push(new T("name","fullPath",!0));function e(o,i){return Lt(i)}const n=new T("name");n.xform=e,t.push(n);function s(o,i){return i!==void 0?Number(i):i}const r=new T("size");return r.xform=s,t.push(r),t.push(new T("timeCreated")),t.push(new T("updated")),t.push(new T("md5Hash",null,!0)),t.push(new T("cacheControl",null,!0)),t.push(new T("contentDisposition",null,!0)),t.push(new T("contentEncoding",null,!0)),t.push(new T("contentLanguage",null,!0)),t.push(new T("contentType",null,!0)),t.push(new T("metadata","customMetadata",!0)),X=t,X}function Bt(t,e){function n(){const s=t.bucket,r=t.fullPath,o=new k(s,r);return e._makeStorageReference(o)}Object.defineProperty(t,"ref",{get:n})}function qt(t,e,n){const s={};s.type="file";const r=n.length;for(let o=0;o<r;o++){const i=n[o];s[i.local]=i.xform(s,e[i.server])}return Bt(s,t),s}function Pe(t,e,n){const s=re(e);return s===null?null:qt(t,s,n)}function Mt(t,e,n,s){const r=re(e);if(r===null||!W(r.downloadTokens))return null;const o=r.downloadTokens;if(o.length===0)return null;const i=encodeURIComponent;return o.split(",").map(l=>{const c=t.bucket,f=t.fullPath,p="/b/"+i(c)+"/o/"+i(f),m=x(p,n,s),g=Ee({alt:"media",token:l});return m+g})[0]}function oe(t,e){const n={},s=e.length;for(let r=0;r<s;r++){const o=e[r];o.writable&&(n[o.server]=t[o.local])}return JSON.stringify(n)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const he="prefixes",de="items";function Ft(t,e,n){const s={prefixes:[],items:[],nextPageToken:n.nextPageToken};if(n[he])for(const r of n[he]){const o=r.replace(/\/$/,""),i=t._makeStorageReference(new k(e,o));s.prefixes.push(i)}if(n[de])for(const r of n[de]){const o=t._makeStorageReference(new k(e,r.name));s.items.push(o)}return s}function Ht(t,e,n){const s=re(n);return s===null?null:Ft(t,e,s)}class O{constructor(e,n,s,r){this.url=e,this.method=n,this.handler=s,this.timeout=r,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function S(t){if(!t)throw ne()}function V(t,e){function n(s,r){const o=Pe(t,r,e);return S(o!==null),o}return n}function $t(t,e){function n(s,r){const o=Ht(t,e,r);return S(o!==null),o}return n}function zt(t,e){function n(s,r){const o=Pe(t,r,e);return S(o!==null),Mt(o,r,t.host,t._protocol)}return n}function q(t){function e(n,s){let r;return n.getStatus()===401?n.getErrorText().includes("Firebase App Check token is invalid")?r=rt():r=st():n.getStatus()===402?r=nt(t.bucket):n.getStatus()===403?r=ot(t.path):r=s,r.status=n.getStatus(),r.serverResponse=s.serverResponse,r}return e}function z(t){const e=q(t);function n(s,r){let o=e(s,r);return s.getStatus()===404&&(o=tt(t.path)),o.serverResponse=r.serverResponse,o}return n}function xe(t,e,n){const s=e.fullServerUrl(),r=x(s,t.host,t._protocol),o="GET",i=t.maxOperationRetryTime,u=new O(r,o,V(t,n),i);return u.errorHandler=z(e),u}function jt(t,e,n,s,r){const o={};e.isRoot?o.prefix="":o.prefix=e.path+"/",n.length>0&&(o.delimiter=n),s&&(o.pageToken=s),r&&(o.maxResults=r);const i=e.bucketOnlyServerUrl(),u=x(i,t.host,t._protocol),a="GET",l=t.maxOperationRetryTime,c=new O(u,a,$t(t,e.bucket),l);return c.urlParams=o,c.errorHandler=q(e),c}function Ne(t,e,n){const s=e.fullServerUrl(),r=x(s,t.host,t._protocol)+"?alt=media",o="GET",i=t.maxOperationRetryTime,u=new O(r,o,(a,l)=>l,i);return u.errorHandler=z(e),n!==void 0&&(u.headers.Range=`bytes=0-${n}`,u.successCodes=[200,206]),u}function Xt(t,e,n){const s=e.fullServerUrl(),r=x(s,t.host,t._protocol),o="GET",i=t.maxOperationRetryTime,u=new O(r,o,zt(t,n),i);return u.errorHandler=z(e),u}function Gt(t,e,n,s){const r=e.fullServerUrl(),o=x(r,t.host,t._protocol),i="PATCH",u=oe(n,s),a={"Content-Type":"application/json; charset=utf-8"},l=t.maxOperationRetryTime,c=new O(o,i,V(t,s),l);return c.headers=a,c.body=u,c.errorHandler=z(e),c}function Wt(t,e){const n=e.fullServerUrl(),s=x(n,t.host,t._protocol),r="DELETE",o=t.maxOperationRetryTime;function i(a,l){}const u=new O(s,r,i,o);return u.successCodes=[200,204],u.errorHandler=z(e),u}function Vt(t,e){return t&&t.contentType||e&&e.type()||"application/octet-stream"}function ve(t,e,n){const s=Object.assign({},n);return s.fullPath=t.path,s.size=e.size(),s.contentType||(s.contentType=Vt(null,e)),s}function De(t,e,n,s,r){const o=e.bucketOnlyServerUrl(),i={"X-Goog-Upload-Protocol":"multipart"};function u(){let R="";for(let b=0;b<2;b++)R=R+Math.random().toString().slice(2);return R}const a=u();i["Content-Type"]="multipart/related; boundary="+a;const l=ve(e,s,r),c=oe(l,n),f="--"+a+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+c+`\r
--`+a+`\r
Content-Type: `+l.contentType+`\r
\r
`,p=`\r
--`+a+"--",m=P.getBlob(f,s,p);if(m===null)throw we();const g={name:l.fullPath},w=x(o,t.host,t._protocol),_="POST",I=t.maxUploadRetryTime,C=new O(w,_,V(t,n),I);return C.urlParams=g,C.headers=i,C.body=m.uploadData(),C.errorHandler=q(e),C}class G{constructor(e,n,s,r){this.current=e,this.total=n,this.finalized=!!s,this.metadata=r||null}}function ie(t,e){let n=null;try{n=t.getResponseHeader("X-Goog-Upload-Status")}catch{S(!1)}return S(!!n&&(e||["active"]).indexOf(n)!==-1),n}function Kt(t,e,n,s,r){const o=e.bucketOnlyServerUrl(),i=ve(e,s,r),u={name:i.fullPath},a=x(o,t.host,t._protocol),l="POST",c={"X-Goog-Upload-Protocol":"resumable","X-Goog-Upload-Command":"start","X-Goog-Upload-Header-Content-Length":`${s.size()}`,"X-Goog-Upload-Header-Content-Type":i.contentType,"Content-Type":"application/json; charset=utf-8"},f=oe(i,n),p=t.maxUploadRetryTime;function m(w){ie(w);let _;try{_=w.getResponseHeader("X-Goog-Upload-URL")}catch{S(!1)}return S(W(_)),_}const g=new O(a,l,m,p);return g.urlParams=u,g.headers=c,g.body=f,g.errorHandler=q(e),g}function Yt(t,e,n,s){const r={"X-Goog-Upload-Command":"query"};function o(l){const c=ie(l,["active","final"]);let f=null;try{f=l.getResponseHeader("X-Goog-Upload-Size-Received")}catch{S(!1)}f||S(!1);const p=Number(f);return S(!isNaN(p)),new G(p,s.size(),c==="final")}const i="POST",u=t.maxUploadRetryTime,a=new O(n,i,o,u);return a.headers=r,a.errorHandler=q(e),a}const fe=256*1024;function Zt(t,e,n,s,r,o,i,u){const a=new G(0,0);if(i?(a.current=i.current,a.total=i.total):(a.current=0,a.total=s.size()),s.size()!==a.total)throw ct();const l=a.total-a.current;let c=l;r>0&&(c=Math.min(c,r));const f=a.current,p=f+c;let m="";c===0?m="finalize":l===c?m="upload, finalize":m="upload";const g={"X-Goog-Upload-Command":m,"X-Goog-Upload-Offset":`${a.current}`},w=s.slice(f,p);if(w===null)throw we();function _(b,D){const L=ie(b,["active","final"]),K=a.current+c,M=s.size();let Y;return L==="final"?Y=V(e,o)(b,D):Y=null,new G(K,M,L==="final",Y)}const I="POST",C=e.maxUploadRetryTime,R=new O(n,I,_,C);return R.headers=g,R.body=w.uploadData(),R.progressCallback=u||null,R.errorHandler=q(t),R}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yn={STATE_CHANGED:"state_changed"},y={RUNNING:"running",PAUSED:"paused",SUCCESS:"success",CANCELED:"canceled",ERROR:"error"};function Q(t){switch(t){case"running":case"pausing":case"canceling":return y.RUNNING;case"paused":return y.PAUSED;case"success":return y.SUCCESS;case"canceled":return y.CANCELED;case"error":return y.ERROR;default:return y.ERROR}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jt{constructor(e,n,s){if(gt(e)||n!=null||s!=null)this.next=e,this.error=n??void 0,this.complete=s??void 0;else{const o=e;this.next=o.next,this.error=o.error,this.complete=o.complete}}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function B(t){return(...e)=>{Promise.resolve().then(()=>t(...e))}}class ae{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=N.NO_ERROR,this.sendPromise_=new Promise(e=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=N.ABORT,e()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=N.NETWORK_ERROR,e()}),this.xhr_.addEventListener("load",()=>{e()})})}send(e,n,s,r,o){if(this.sent_)throw F("cannot .send() more than once");if(ge(e)&&s&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(n,e,!0),o!==void 0)for(const i in o)o.hasOwnProperty(i)&&this.xhr_.setRequestHeader(i,o[i].toString());return r!==void 0?this.xhr_.send(r):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw F("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw F("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw F("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw F("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(e){return this.xhr_.getResponseHeader(e)}addUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",e)}removeUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",e)}}class Qt extends ae{initXhr(){this.xhr_.responseType="text"}}function U(){return new Qt}class en extends ae{initXhr(){this.xhr_.responseType="arraybuffer"}}function tn(){return new en}class nn extends ae{initXhr(){this.xhr_.responseType="blob"}}function sn(){return new nn}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rn{isExponentialBackoffExpired(){return this.sleepTime>this.maxSleepTime}constructor(e,n,s=null){this._transferred=0,this._needToFetchStatus=!1,this._needToFetchMetadata=!1,this._observers=[],this._error=void 0,this._uploadUrl=void 0,this._request=void 0,this._chunkMultiplier=1,this._resolve=void 0,this._reject=void 0,this._ref=e,this._blob=n,this._metadata=s,this._mappings=$(),this._resumable=this._shouldDoResumable(this._blob),this._state="running",this._errorHandler=r=>{if(this._request=void 0,this._chunkMultiplier=1,r._codeEquals(h.CANCELED))this._needToFetchStatus=!0,this.completeTransitions_();else{const o=this.isExponentialBackoffExpired();if(Ue(r.status,[]))if(o)r=Te();else{this.sleepTime=Math.max(this.sleepTime*2,et),this._needToFetchStatus=!0,this.completeTransitions_();return}this._error=r,this._transition("error")}},this._metadataErrorHandler=r=>{this._request=void 0,r._codeEquals(h.CANCELED)?this.completeTransitions_():(this._error=r,this._transition("error"))},this.sleepTime=0,this.maxSleepTime=this._ref.storage.maxUploadRetryTime,this._promise=new Promise((r,o)=>{this._resolve=r,this._reject=o,this._start()}),this._promise.then(null,()=>{})}_makeProgressCallback(){const e=this._transferred;return n=>this._updateProgress(e+n)}_shouldDoResumable(e){return e.size()>256*1024}_start(){this._state==="running"&&this._request===void 0&&(this._resumable?this._uploadUrl===void 0?this._createResumable():this._needToFetchStatus?this._fetchStatus():this._needToFetchMetadata?this._fetchMetadata():this.pendingTimeout=setTimeout(()=>{this.pendingTimeout=void 0,this._continueUpload()},this.sleepTime):this._oneShotUpload())}_resolveToken(e){Promise.all([this._ref.storage._getAuthToken(),this._ref.storage._getAppCheckToken()]).then(([n,s])=>{switch(this._state){case"running":e(n,s);break;case"canceling":this._transition("canceled");break;case"pausing":this._transition("paused");break}})}_createResumable(){this._resolveToken((e,n)=>{const s=Kt(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),r=this._ref.storage._makeRequest(s,U,e,n);this._request=r,r.getPromise().then(o=>{this._request=void 0,this._uploadUrl=o,this._needToFetchStatus=!1,this.completeTransitions_()},this._errorHandler)})}_fetchStatus(){const e=this._uploadUrl;this._resolveToken((n,s)=>{const r=Yt(this._ref.storage,this._ref._location,e,this._blob),o=this._ref.storage._makeRequest(r,U,n,s);this._request=o,o.getPromise().then(i=>{i=i,this._request=void 0,this._updateProgress(i.current),this._needToFetchStatus=!1,i.finalized&&(this._needToFetchMetadata=!0),this.completeTransitions_()},this._errorHandler)})}_continueUpload(){const e=fe*this._chunkMultiplier,n=new G(this._transferred,this._blob.size()),s=this._uploadUrl;this._resolveToken((r,o)=>{let i;try{i=Zt(this._ref._location,this._ref.storage,s,this._blob,e,this._mappings,n,this._makeProgressCallback())}catch(a){this._error=a,this._transition("error");return}const u=this._ref.storage._makeRequest(i,U,r,o,!1);this._request=u,u.getPromise().then(a=>{this._increaseMultiplier(),this._request=void 0,this._updateProgress(a.current),a.finalized?(this._metadata=a.metadata,this._transition("success")):this.completeTransitions_()},this._errorHandler)})}_increaseMultiplier(){fe*this._chunkMultiplier*2<32*1024*1024&&(this._chunkMultiplier*=2)}_fetchMetadata(){this._resolveToken((e,n)=>{const s=xe(this._ref.storage,this._ref._location,this._mappings),r=this._ref.storage._makeRequest(s,U,e,n);this._request=r,r.getPromise().then(o=>{this._request=void 0,this._metadata=o,this._transition("success")},this._metadataErrorHandler)})}_oneShotUpload(){this._resolveToken((e,n)=>{const s=De(this._ref.storage,this._ref._location,this._mappings,this._blob,this._metadata),r=this._ref.storage._makeRequest(s,U,e,n);this._request=r,r.getPromise().then(o=>{this._request=void 0,this._metadata=o,this._updateProgress(this._blob.size()),this._transition("success")},this._errorHandler)})}_updateProgress(e){const n=this._transferred;this._transferred=e,this._transferred!==n&&this._notifyObservers()}_transition(e){if(this._state!==e)switch(e){case"canceling":case"pausing":this._state=e,this._request!==void 0?this._request.cancel():this.pendingTimeout&&(clearTimeout(this.pendingTimeout),this.pendingTimeout=void 0,this.completeTransitions_());break;case"running":const n=this._state==="paused";this._state=e,n&&(this._notifyObservers(),this._start());break;case"paused":this._state=e,this._notifyObservers();break;case"canceled":this._error=ke(),this._state=e,this._notifyObservers();break;case"error":this._state=e,this._notifyObservers();break;case"success":this._state=e,this._notifyObservers();break}}completeTransitions_(){switch(this._state){case"pausing":this._transition("paused");break;case"canceling":this._transition("canceled");break;case"running":this._start();break}}get snapshot(){const e=Q(this._state);return{bytesTransferred:this._transferred,totalBytes:this._blob.size(),state:e,metadata:this._metadata,task:this,ref:this._ref}}on(e,n,s,r){const o=new Jt(n||void 0,s||void 0,r||void 0);return this._addObserver(o),()=>{this._removeObserver(o)}}then(e,n){return this._promise.then(e,n)}catch(e){return this.then(null,e)}_addObserver(e){this._observers.push(e),this._notifyObserver(e)}_removeObserver(e){const n=this._observers.indexOf(e);n!==-1&&this._observers.splice(n,1)}_notifyObservers(){this._finishPromise(),this._observers.slice().forEach(n=>{this._notifyObserver(n)})}_finishPromise(){if(this._resolve!==void 0){let e=!0;switch(Q(this._state)){case y.SUCCESS:B(this._resolve.bind(null,this.snapshot))();break;case y.CANCELED:case y.ERROR:const n=this._reject;B(n.bind(null,this._error))();break;default:e=!1;break}e&&(this._resolve=void 0,this._reject=void 0)}}_notifyObserver(e){switch(Q(this._state)){case y.RUNNING:case y.PAUSED:e.next&&B(e.next.bind(e,this.snapshot))();break;case y.SUCCESS:e.complete&&B(e.complete.bind(e))();break;case y.CANCELED:case y.ERROR:e.error&&B(e.error.bind(e,this._error))();break;default:e.error&&B(e.error.bind(e,this._error))()}}resume(){const e=this._state==="paused"||this._state==="pausing";return e&&this._transition("running"),e}pause(){const e=this._state==="running";return e&&this._transition("pausing"),e}cancel(){const e=this._state==="running"||this._state==="pausing";return e&&this._transition("canceling"),e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class v{constructor(e,n){this._service=e,n instanceof k?this._location=n:this._location=k.makeFromUrl(n,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,n){return new v(e,n)}get root(){const e=new k(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return Ce(this._location.path)}get storage(){return this._service}get parent(){const e=Nt(this._location.path);if(e===null)return null;const n=new k(this._location.bucket,e);return new v(this._service,n)}_throwIfRoot(e){if(this._location.path==="")throw dt(e)}}function on(t,e){t._throwIfRoot("getBytes");const n=Ne(t.storage,t._location,e);return t.storage.makeRequestWithTokens(n,tn).then(s=>e!==void 0?s.slice(0,e):s)}function an(t,e){t._throwIfRoot("getBlob");const n=Ne(t.storage,t._location,e);return t.storage.makeRequestWithTokens(n,sn).then(s=>e!==void 0?s.slice(0,e):s)}function Le(t,e,n){t._throwIfRoot("uploadBytes");const s=De(t.storage,t._location,$(),new P(e,!0),n);return t.storage.makeRequestWithTokens(s,U).then(r=>({metadata:r,ref:t}))}function un(t,e,n){return t._throwIfRoot("uploadBytesResumable"),new rn(t,new P(e),n)}function cn(t,e,n=A.RAW,s){t._throwIfRoot("uploadString");const r=Ae(n,e),o={...s};return o.contentType==null&&r.contentType!=null&&(o.contentType=r.contentType),Le(t,r.data,o)}function ln(t){const e={prefixes:[],items:[]};return Be(t,e).then(()=>e)}async function Be(t,e,n){const r=await qe(t,{pageToken:n});e.prefixes.push(...r.prefixes),e.items.push(...r.items),r.nextPageToken!=null&&await Be(t,e,r.nextPageToken)}function qe(t,e){e!=null&&typeof e.maxResults=="number"&&te("options.maxResults",1,1e3,e.maxResults);const n=e||{},s=jt(t.storage,t._location,"/",n.pageToken,n.maxResults);return t.storage.makeRequestWithTokens(s,U)}function hn(t){t._throwIfRoot("getMetadata");const e=xe(t.storage,t._location,$());return t.storage.makeRequestWithTokens(e,U)}function dn(t,e){t._throwIfRoot("updateMetadata");const n=Gt(t.storage,t._location,e,$());return t.storage.makeRequestWithTokens(n,U)}function fn(t){t._throwIfRoot("getDownloadURL");const e=Xt(t.storage,t._location,$());return t.storage.makeRequestWithTokens(e,U).then(n=>{if(n===null)throw lt();return n})}function _n(t){t._throwIfRoot("deleteObject");const e=Wt(t.storage,t._location);return t.storage.makeRequestWithTokens(e,U)}function Me(t,e){const n=vt(t._location.path,e),s=new k(t._location.bucket,n);return new v(t.storage,s)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function pn(t){return/^[A-Za-z]+:\/\//.test(t)}function mn(t,e){return new v(t,e)}function Fe(t,e){if(t instanceof ue){const n=t;if(n._bucket==null)throw ut();const s=new v(n,n._bucket);return e!=null?Fe(s,e):s}else return e!==void 0?Me(t,e):t}function gn(t,e){if(e&&pn(e)){if(t instanceof ue)return mn(t,e);throw ee("To use ref(service, url), the first argument must be a Storage instance.")}else return Fe(t,e)}function _e(t,e){const n=e?.[Re];return n==null?null:k.makeFromBucketSpec(n,t)}function bn(t,e,n,s={}){t.host=`${e}:${n}`;const r=ge(e);r&&Ge(`https://${t.host}/b`),t._isUsingEmulator=!0,t._protocol=r?"https":"http";const{mockUserToken:o}=s;o&&(t._overrideAuthToken=typeof o=="string"?o:We(o,t.app.options.projectId))}class ue{constructor(e,n,s,r,o,i=!1){this.app=e,this._authProvider=n,this._appCheckProvider=s,this._url=r,this._firebaseVersion=o,this._isUsingEmulator=i,this._bucket=null,this._host=be,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=Je,this._maxUploadRetryTime=Qe,this._requests=new Set,r!=null?this._bucket=k.makeFromBucketSpec(r,this._host):this._bucket=_e(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,this._url!=null?this._bucket=k.makeFromBucketSpec(this._url,e):this._bucket=_e(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){te("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){te("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const e=this._authProvider.getImmediate({optional:!0});if(e){const n=await e.getToken();if(n!==null)return n.accessToken}return null}async _getAppCheckToken(){if(Ve(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new v(this,e)}_makeRequest(e,n,s,r,o=!0){if(this._deleted)return new ft(ye());{const i=Et(e,this._appId,s,r,n,this._firebaseVersion,o,this._isUsingEmulator);return this._requests.add(i),i.getPromise().then(()=>this._requests.delete(i),()=>this._requests.delete(i)),i}}async makeRequestWithTokens(e,n){const[s,r]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,n,s,r).getPromise()}}const pe="@firebase/storage",me="0.14.3";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const He="storage";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function En(t,e){return t=E(t),on(t,e)}function Un(t,e,n){return t=E(t),Le(t,e,n)}function An(t,e,n,s){return t=E(t),cn(t,e,n,s)}function Sn(t,e,n){return t=E(t),un(t,e,n)}function On(t){return t=E(t),hn(t)}function In(t,e){return t=E(t),dn(t,e)}function Cn(t,e){return t=E(t),qe(t,e)}function Pn(t){return t=E(t),ln(t)}function xn(t){return t=E(t),fn(t)}function Nn(t){return t=E(t),_n(t)}function vn(t,e){return t=E(t),gn(t,e)}function Dn(t,e){return Me(t,e)}function Ln(t=Xe(),e){t=E(t);const s=ze(t,He).getImmediate({identifier:e}),r=je("storage");return r&&Rn(s,...r),s}function Rn(t,e,n,s={}){bn(t,e,n,s)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Bn(t,e){return t=E(t),an(t,e)}function qn(t,e){throw new Error("getStream() is only supported by NodeJS builds")}function Tn(t,{instanceIdentifier:e}){const n=t.getProvider("app").getImmediate(),s=t.getProvider("auth-internal"),r=t.getProvider("app-check-internal");return new ue(n,s,r,e,Ze)}function kn(){Ke(new Ye(He,Tn,"PUBLIC").setMultipleInstances(!0)),ce(pe,me,""),ce(pe,me,"esm2020")}kn();export{d as StorageError,h as StorageErrorCode,A as StringFormat,P as _FbsBlob,k as _Location,yn as _TaskEvent,y as _TaskState,rn as _UploadTask,Ae as _dataFromString,Dn as _getChild,ee as _invalidArgument,dt as _invalidRootOperation,Rn as connectStorageEmulator,Nn as deleteObject,Bn as getBlob,En as getBytes,xn as getDownloadURL,On as getMetadata,Ln as getStorage,qn as getStream,Cn as list,Pn as listAll,vn as ref,In as updateMetadata,Un as uploadBytes,Sn as uploadBytesResumable,An as uploadString};
