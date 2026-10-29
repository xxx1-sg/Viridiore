/** AI 助手 */
import { icon } from '../core/icons.js';
import { appState, ensureWeather, currentMountain } from '../state.js';
import { ask, renderAnswer, QUICK_QUESTIONS } from '../services/ai.js';
import { config } from '../config.js';
import { formatTime, greeting } from '../core/format.js';
import { escapeHtml } from '../core/dom.js';

let history = [];

export default {
  id: 'ai',
  title: 'AI 助手',
  icon: 'bot',

  template() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-head__title">AI 助手</h1>
          <p class="page-head__desc" id="aiMode">${config.hasLLM() ? '在线大模型' : '内置户外知识引擎'}</p>
        </div>
        <div class="page-head__actions">
          <button class="icon-btn" type="button" data-action="clear" title="清空对话">${icon('trash', 19)}</button>
        </div>
      </div>

      <div class="chat">
        <div class="chat__log" id="chatLog"></div>
        <div class="chat__quick" id="chatQuick">
          ${QUICK_QUESTIONS.map((q) => `<button class="chip" type="button" data-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`).join('')}
        </div>
        <div class="chat__input">
          <textarea class="textarea" id="chatInput" rows="1" placeholder="问问天气、路线、装备或安全…"></textarea>
          <button class="chat-send" type="button" id="chatSend" aria-label="发送">${icon('send', 17)}</button>
        </div>
      </div>

      <p class="field__hint" style="padding:12px 4px">
        回答基于内置户外知识库与当前天气，仅供参考；紧急情况请直接拨打 110 / 119。
        ${config.hasLLM() ? '' : '在「设置」中配置大模型接口可切换到更自由的对话。'}
      </p>
    `;
  },

  async mount(el) {
    const $ = (s) => el.querySelector(s);
    const log = $('#chatLog');
    const input = $('#chatInput');

    const scrollBottom = () => {
      log.scrollTop = log.scrollHeight;
    };

    const bubble = (role, html, { time = Date.now(), typing = false } = {}) => {
      const node = document.createElement('div');
      node.className = `msg msg--${role}`;
      node.innerHTML = `
        <span class="msg__avatar">${icon(role === 'user' ? 'users' : 'bot', 16)}</span>
        <div>
          <div class="msg__bubble">${typing ? '<span class="typing"><i></i><i></i><i></i></span>' : html}</div>
          ${typing ? '' : `<div class="msg__time">${formatTime(time)}</div>`}
        </div>`;
      log.appendChild(node);
      scrollBottom();
      return node;
    };

    const pushHistory = (role, text) => {
      history.push({ role, text, ts: Date.now() });
      if (history.length > 40) history = history.slice(-40);
    };

    const renderHistory = () => {
      log.innerHTML = '';
      if (!history.length) {
        bubble(
          'assistant',
          renderAnswer(
            `${greeting()}，我是晓山青的户外助手。\n\n可以问我：\n• 今天适不适合上山\n• 这周哪天看日出最好\n• 某座山的强度与路线\n• 失温、迷路、蛇虫等应急处理`
          )
        );
        return;
      }
      history.forEach((m) => bubble(m.role === 'user' ? 'user' : 'assistant', renderAnswer(m.text), { time: m.ts }));
    };

    const send = async (text) => {
      const question = String(text || '').trim();
      if (!question) return;

      input.value = '';
      input.style.height = 'auto';
      pushHistory('user', question);
      bubble('user', renderAnswer(question));

      const typingNode = bubble('assistant', '', { typing: true });

      const ctx = {
        weather: appState.weather,
        mountain: currentMountain(),
        greeting: greeting()
      };

      try {
        const res = await ask(question, ctx);
        typingNode.remove();
        bubble('assistant', renderAnswer(res.text));
        pushHistory('assistant', res.text);
      } catch (err) {
        typingNode.remove();
        bubble('assistant', renderAnswer('抱歉，我这边出了点问题。可以换个问法再试一次。'));
        console.warn(err);
      }
    };

    $('#chatSend').addEventListener('click', () => send(input.value));

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send(input.value);
      }
    });

    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = `${Math.min(120, input.scrollHeight)}px`;
    });

    el.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]');
      if (q) send(q.dataset.q);
      if (e.target.closest('[data-action="clear"]')) {
        history = [];
        renderHistory();
      }
    });

    ensureWeather().catch(() => {});
    renderHistory();

    return () => {};
  }
};
