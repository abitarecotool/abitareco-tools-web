/* ================================ IUBENDA ============================= */

const IubSiteId = $('#IubSiteId');
const IubCookieIt = $('#IubCookieIt');
const IubCookieEn = $('#IubCookieEn');
const IubCookieEnWrap = $('#IubCookieEnWrap');
const IubWidgetUrl = $('#IubWidgetUrl');
const IubDualLang = $('#IubDualLang');
const IubCopyBtn = $('#IubCopyBtn');
const IubOut = $('#IubOut');

function iubSyncEnVisibility(){
  if (!IubCookieEnWrap) return;
  if (IubDualLang?.checked){
    IubCookieEnWrap.classList.remove('hidden');
  } else {
    IubCookieEnWrap.classList.add('hidden');
    if (IubCookieEn) IubCookieEn.value = '';
  }
}
IubDualLang?.addEventListener('change', iubSyncEnVisibility);

function makeIubendaSnippet(){
  const siteId   = (IubSiteId?.value || '').trim();
  const cpIt     = (IubCookieIt?.value || '').trim();
  const cpEn     = (IubCookieEn?.value || '').trim();
  const widgetJs = (IubWidgetUrl?.value || '').trim();

  if (!siteId || !cpIt){
    alert('Compila siteId e cookiePolicyId (IT).');
    return;
  }
  if (IubDualLang?.checked && !cpEn){
    alert('Hai selezionato EN: compila cookiePolicyId (EN).');
    return;
  }
  if (!widgetJs){
    alert('Inserisci il Widget URL di Iubenda.');
    return;
  }

  let snippet = '';

  if (IubDualLang?.checked) {
    // ✅ IT + EN automatico
    snippet = `
<script type="text/javascript">
  var lang = document.documentElement.lang === 'en' ? 'en' : 'it';

  var _iub = _iub || [];
  _iub.csConfiguration = {
    lang: lang,
    siteId: ${siteId},
    cookiePolicyId: (lang === 'en' ? ${cpEn} : ${cpIt}),
    banner: {
      position: "float-bottom-center",
      acceptButtonDisplay: true,
      customizeButtonDisplay: true
    },
    callback: {
      onPreferenceExpressedOrNotNeeded: function (preference) {
        window.dataLayer = window.dataLayer || [];
        dataLayer.push({
          iubenda_ccpa_opted_out: _iub.cs.api.isCcpaOptedOut()
        });

        var otherPreferences = _iub.cs.api.getPreferences();
        if (otherPreferences) {
          var usprPreferences = otherPreferences.uspr;
          if (usprPreferences) {
            for (var purposeName in usprPreferences) {

              if (usprPreferences[purposeName]) {
                dataLayer.push({
                  event: 'iubenda_consent_given_purpose_' + purposeName
                });
              }
            }
          }
        }

        if (!preference) {
          dataLayer.push({ event: 'iubenda_preference_not_needed' });
        } else if (preference.consent === true) {
          dataLayer.push({ event: 'iubenda_consent_given' });
        } else if (preference.consent === false) {
          dataLayer.push({ event: 'iubenda_consent_rejected' });
        } else if (preference.purposes) {
          for (var purposeId in preference.purposes) {
            if (preference.purposes[purposeId]) {
              dataLayer.push({
                event: 'iubenda_consent_given_purpose_' + purposeId
              });
            }
          }
        }
      }
    }
  };
</script>
<script type="text/javascript" src="${widgetJs}"></script>
`.trim();

  } else {
    // ✅ SOLO IT
    snippet = `
<script type="text/javascript">
  var _iub = _iub || [];
  _iub.csConfiguration = {
    lang: "it",
    siteId: ${siteId},
    cookiePolicyId: ${cpIt},
    banner: {
      position: "float-bottom-center",
      acceptButtonDisplay: true,
      customizeButtonDisplay: true
    },
    callback: {
      onPreferenceExpressedOrNotNeeded: function (preference) {
        window.dataLayer = window.dataLayer || [];
        dataLayer.push({
          iubenda_ccpa_opted_out: _iub.cs.api.isCcpaOptedOut()
        });

        var otherPreferences = _iub.cs.api.getPreferences();
        if (otherPreferences) {
          var usprPreferences = otherPreferences.uspr;
          if (usprPreferences) {
            for (var purposeName in usprPreferences) {
              if (usprPreferences[purposeName]) {
                dataLayer.push({
                  event: 'iubenda_consent_given_purpose_' + purposeName
                });
              }
            }
          }
        }

        if (!preference) {
          dataLayer.push({ event: 'iubenda_preference_not_needed' });
        } else if (preference.consent === true) {
          dataLayer.push({ event: 'iubenda_consent_given' });
        } else if (preference.consent === false) {
          dataLayer.push({ event: 'iubenda_consent_rejected' });
        } else if (preference.purposes) {
          for (var purposeId in preference.purposes) {
            if (preference.purposes[purposeId]) {
              dataLayer.push({
                event: 'iubenda_consent_given_purpose_' + purposeId
              });
            }
          }
        }
      }
    }
  };
</script>
<script type="text/javascript" src="${widgetJs}"></script>
`.trim();
  }

  IubOut.value = snippet;
}

IubCopyBtn?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(IubOut.value);
    alert('Snippet copiato negli appunti.');
  } catch {
    IubOut.select();
    document.execCommand('copy');
    alert('Snippet copiato (fallback).');
  }
});

try { iubSyncEnVisibility(); } catch {}

/* ============================== FINE IUBENDA =========================== */

