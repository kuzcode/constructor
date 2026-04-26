const KIND_LABEL = {
  poll: 'Опрос',
  button_notify: 'Нажатие кнопки',
};

export function feedbackKindLabel(kind) {
  return KIND_LABEL[kind] || kind || '—';
}

/** Строки для таблицы: заголовок столбца → значение */
export function feedbackPayloadRows(kind, payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  if (kind === 'poll') {
    return [
      { key: 'question', label: 'Вопрос', value: p.question ?? '—' },
      { key: 'answer', label: 'Ответ', value: p.label ?? '—' },
      { key: 'mode', label: 'Режим', value: p.mode === 'quiz' ? 'Викторина' : p.mode === 'survey' ? 'Опрос' : (p.mode ?? '—') },
      {
        key: 'correct',
        label: 'Верно',
        value: p.mode === 'quiz' ? (p.correct ? 'Да' : 'Нет') : '—',
      },
    ];
  }
  if (kind === 'button_notify') {
    return [
      { key: 'button', label: 'Текст кнопки', value: p.label ?? '—' },
      { key: 'message', label: 'Сообщение', value: p.message ?? '—' },
    ];
  }
  return Object.entries(p).map(([k, v]) => ({
    key: k,
    label: k,
    value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—'),
  }));
}
