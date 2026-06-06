const STORE_KEY = 'komorebi_bookings_v1';

const seating = [
  { time: '17:30', label: 'ディナー', capacity: 8 },
  { time: '19:00', label: 'ディナー', capacity: 6 },
  { time: '20:30', label: 'ディナー', capacity: 0 },
  { time: '21:00', label: 'バー利用', capacity: 10 },
];

const menu = [
  {
    name: '季節野菜の前菜',
    text: '旬の野菜を中心に、軽く始められる盛り合わせです。',
    price: '¥1,280',
    image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1000&q=80',
    alt: '前菜プレート',
  },
  {
    name: 'グリルメイン',
    text: '肉料理または魚料理から選べる、ディナーの中心になる一皿です。',
    price: '¥2,600',
    image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=1000&q=80',
    alt: 'メイン料理のステーキ',
  },
  {
    name: 'デザートセット',
    text: '食後のデザートとドリンクを組み合わせたセットです。',
    price: '¥980',
    image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=1000&q=80',
    alt: 'デザートとコーヒー',
  },
];

const $ = (selector) => document.querySelector(selector);

const clean = (value) =>
  String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  }[char]));

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function readBookings() {
  return JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
}

function writeBookings(rows) {
  localStorage.setItem(STORE_KEY, JSON.stringify(rows));
}

function bookingsOn(date) {
  return readBookings().filter((booking) => booking.date === date);
}

function takenSeats(date, time) {
  return bookingsOn(date)
    .filter((booking) => booking.time === time)
    .reduce((sum, booking) => sum + Number(booking.party), 0);
}

function seatsLeft(date, slot) {
  return Math.max(0, slot.capacity - takenSeats(date, slot.time));
}

function renderMenu() {
  $('#menuRoot').innerHTML = menu.map((dish) => `
    <article class="menu-card">
      <img alt="${dish.alt}" src="${dish.image}">
      <div>
        <h3>${dish.name}</h3>
        <p>${dish.text}</p>
        <span class="price">${dish.price}</span>
      </div>
    </article>
  `).join('');
}

function fillTimeSelect(date) {
  const select = $('#timeSelect');
  const previous = select.value;

  const options = seating
    .filter((slot) => seatsLeft(date, slot) > 0)
    .map((slot) => {
      const left = seatsLeft(date, slot);
      return `<option value="${slot.time}">${slot.time}（残り${left}席）</option>`;
    });

  select.innerHTML = '<option value="">選択してください</option>' + options.join('');

  if ([...select.options].some((option) => option.value === previous)) {
    select.value = previous;
  }
}

function chooseSlot(date, time) {
  $('#formDate').value = date;
  $('#timeSelect').value = time;
  $('#summary').textContent = `選択中の時間: ${date} ${time}`;
  document.getElementById('reservation').scrollIntoView({ behavior: 'smooth' });
}

function renderSlots() {
  const date = $('#selectedDate').value;

  $('#slotsRoot').innerHTML = seating.map((slot) => {
    const left = seatsLeft(date, slot);
    const isFull = left <= 0;
    const label = slot.capacity === 0 ? '満席' : `残り ${left}席`;

    return `
      <article class="slot ${isFull ? 'full' : ''}">
        <span>${slot.label}</span>
        <strong>${slot.time}</strong>
        <span>${label}</span>
        <button ${isFull ? 'disabled' : ''} class="btn" data-time="${slot.time}">この時間で予約</button>
      </article>
    `;
  }).join('');

  document.querySelectorAll('[data-time]').forEach((button) => {
    button.addEventListener('click', () => chooseSlot(date, button.dataset.time));
  });

  fillTimeSelect(date);
}

function cancelBooking(id) {
  if (!confirm('この予約をキャンセルしますか？')) return;

  writeBookings(readBookings().filter((booking) => booking.id !== id));
  renderAll();
  $('#formStatus').textContent = '予約をキャンセルしました。';
}

function renderBookingList() {
  const bookings = readBookings();
  $('#bookingCount').textContent = `${bookings.length}件の予約`;

  if (!bookings.length) {
    $('#bookingList').innerHTML = '<p class="empty">まだ予約は保存されていません。</p>';
    return;
  }

  $('#bookingList').innerHTML = bookings.map((booking) => `
    <article class="booking-card">
      <div>
        <h3>${clean(booking.date)} ${clean(booking.time)} / ${clean(booking.party)}名</h3>
        <p>${clean(booking.name)}様 ${clean(booking.tel)}</p>
        <small>${clean(booking.note || 'ご要望なし')}</small>
      </div>
      <button class="btn secondary" data-cancel="${booking.id}">キャンセル</button>
    </article>
  `).join('');

  document.querySelectorAll('[data-cancel]').forEach((button) => {
    button.addEventListener('click', () => cancelBooking(button.dataset.cancel));
  });
}

function renderAll() {
  renderSlots();
  renderBookingList();
}

function saveReservation(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  const party = Number(data.party);
  const slot = seating.find((entry) => entry.time === data.time);

  if (!slot) {
    $('#formStatus').textContent = '予約時間を選択してください。';
    return;
  }

  const left = seatsLeft(data.date, slot);
  if (party > left) {
    $('#formStatus').textContent = `${data.time}の残席は${left}席です。人数を変更してください。`;
    return;
  }

  const booking = {
    id: `RSV-${Date.now().toString().slice(-6)}`,
    ...data,
    party,
    createdAt: new Date().toLocaleString('ja-JP'),
  };

  writeBookings([booking, ...readBookings()]);
  form.reset();

  $('#selectedDate').value = data.date;
  $('#formDate').value = data.date;
  $('#summary').textContent = '選択中の時間: 未選択';
  $('#formStatus').textContent = `${booking.name}様、${booking.date} ${booking.time} / ${booking.party}名の予約を保存しました。`;

  renderAll();
  location.hash = 'bookings';
}

document.addEventListener('DOMContentLoaded', () => {
  const date = isoToday();

  $('#selectedDate').value = date;
  $('#formDate').value = date;
  renderMenu();
  renderAll();

  $('#selectedDate').addEventListener('change', () => {
    $('#formDate').value = $('#selectedDate').value;
    renderAll();
  });

  $('#formDate').addEventListener('change', () => {
    $('#selectedDate').value = $('#formDate').value;
    renderAll();
  });

  $('#timeSelect').addEventListener('change', () => {
    const time = $('#timeSelect').value || '未選択';
    $('#summary').textContent = `選択中の時間: ${$('#formDate').value} ${time}`;
  });

  $('#reservationForm').addEventListener('submit', saveReservation);

  $('#resetBookings').addEventListener('click', () => {
    if (!confirm('保存された予約をすべて削除しますか？')) return;

    writeBookings([]);
    renderAll();
    $('#formStatus').textContent = '予約データを初期化しました。';
  });
});
