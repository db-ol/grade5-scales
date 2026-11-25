(function () {
  'use strict';

  var translations = [];
  function collect(englishAttribute, targetAttribute) {
    document.querySelectorAll('[' + englishAttribute + ']').forEach(function (element) {
      translations.push({
        element: element,
        attribute: targetAttribute,
        zh: targetAttribute ? element.getAttribute(targetAttribute) : element.textContent,
        en: element.getAttribute(englishAttribute)
      });
    });
  }

  collect('data-en');
  collect('data-en-label', 'aria-label');
  collect('data-en-content', 'content');

  function apply(language) {
    var english = language === 'en';
    document.documentElement.lang = english ? 'en' : 'zh-CN';
    translations.forEach(function (item) {
      var value = english ? item.en : item.zh;
      if (item.attribute) item.element.setAttribute(item.attribute, value);
      else item.element.textContent = value;
    });
    document.title = document.querySelector('.brand h1').textContent;
    document.getElementById('ui-language').value = english ? 'en' : 'zh';
  }

  window.InterfaceText = { apply: apply };
})();
