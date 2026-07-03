import './star-hero-card-style.js';
import { RadioPlayer } from './widgets.js';

const DEDICATION_COST = 20;
const DEDICATION_MAX_CHARS = 100;

if (!RadioPlayer.prototype.__starDedicationRulesPatched) {
  RadioPlayer.prototype.__starDedicationRulesPatched = true;

  const baseRender = RadioPlayer.prototype.render;
  const baseSubmitDedication = RadioPlayer.prototype._submitDedication;

  RadioPlayer.prototype.render = async function dedicationRulesRender(...args) {
    const result = await baseRender.apply(this, args);
    applyDedicationUiRules(this);
    placeRadioBeforePokegang();
    return result;
  };

  RadioPlayer.prototype._submitDedication = function dedicationRulesSubmit(event) {
    const input = this._$('radio-dedication-input');
    const message = input?.value?.trim() ?? '';

    if (message.length > DEDICATION_MAX_CHARS) {
      event?.preventDefault?.();
      this._setDedicationStatus(`${DEDICATION_MAX_CHARS} caracteres maximum`, 'err');
      return Promise.resolve();
    }

    return baseSubmitDedication.call(this, event);
  };
}

function applyDedicationUiRules(player) {
  const form = player.el?.querySelector('#radio-dedication-form');
  if (!form || form.__dedicationRulesApplied) return;
  form.__dedicationRulesApplied = true;

  const price = form.querySelector('.radio-dedication-head strong');
  const input = form.querySelector('#radio-dedication-input');
  const status = form.querySelector('#radio-dedication-status');

  if (price) price.textContent = `${DEDICATION_COST} C`;

  if (input) {
    input.maxLength = DEDICATION_MAX_CHARS;
    input.setAttribute('maxlength', String(DEDICATION_MAX_CHARS));
    input.placeholder = `Message antenne, ${DEDICATION_MAX_CHARS} caracteres max`;
    input.addEventListener('input', () => {
      if (!status) return;
      const remaining = DEDICATION_MAX_CHARS - input.value.length;
      if (remaining <= 20) {
        status.textContent = `${remaining} caracteres restants`;
        status.className = 'radio-dedication-status radio-dedication-status--pending';
      } else if (status.textContent?.includes('caracteres restants')) {
        status.textContent = '';
        status.className = 'radio-dedication-status';
      }
    });
  }
}

function placeRadioBeforePokegang() {
  const radio = document.querySelector('.bc.bc-radio');
  const pokegang = document.querySelector('.bc.bc-pg');
  if (!radio || !pokegang || !pokegang.parentNode || radio.nextElementSibling === pokegang) return;
  pokegang.parentNode.insertBefore(radio, pokegang);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', placeRadioBeforePokegang, { once: true });
} else {
  placeRadioBeforePokegang();
}

window.addEventListener('load', placeRadioBeforePokegang, { once: true });
