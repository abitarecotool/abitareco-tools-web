// js/core/permissions.js
(function(){
  'use strict';
  window.ROLE_LABELS = { admin:'Admin', marketing:'Marketing', tecnico:'Tecnico', riabitare:'RiAbitare Co.', commercial:'Abitare Commercial' };
  window.PERMISSIONS = {
    admin: ['images','platform','digitaltool','pdf2jpg','pdfcompress','rename','video','watermark','bv','qr','iubenda','ppt','fattura','slidebuilder'],
    marketing: ['images','digitaltool','video','watermark','qr','iubenda','ppt','fattura','pdfcompress'],
    tecnico: ['pdf2jpg','pdfcompress','rename'],
    riabitare: ['images','pdf2jpg','pdfcompress','rename'],
    commercial: ['images','pdf2jpg','pdfcompress','rename','video','qr']
  };
})();
