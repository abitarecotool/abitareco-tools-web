// js/core/permissions.js
(function(){
  'use strict';
  window.ROLE_LABELS = { admin:'Admin', marketing:'Marketing', tecnico:'Tecnico', riabitare:'RiAbitare Co.', commercial:'Abitare Commercial' };
  window.PERMISSIONS = {
  admin: ['images','digitaltool','pdf2jpg','rename','video','watermark','bv','qr','iubenda','ppt'],
  marketing: ['images','digitaltool','video','watermark','qr','iubenda','ppt'],
  tecnico: ['pdf2jpg','rename'],
  riabitare: ['images','pdf2jpg','rename'],
  commercial: ['images','pdf2jpg','rename','video','qr']
};
})();
