import express from 'express';

const app = express();

const options = {
  method: 'GET',
  headers: {
    'User-Agent':
      'Mozilla/5.0 (Linux; Android 9; ASUS_X00TD) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.86 Mobile Safari/537.36',
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    'X-Requested-With': 'XMLHttpRequest',
    DNT: '1',
    Connection: 'keep-alive',
    Referer: `${process.env.BASE_URL}/booking`,
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    TE: 'trailers',
  },
};

const scan = async queryParams => {
  const response = await fetch(
    `${process.env.BASE_URL}/api/booking/feed?${queryParams}`,
    options,
  );

  const bookings = await response.json();

  return bookings.map(booking => {
    const { start, end, resourceId } = booking;

    const startDate = new Date(start);
    const endDate = new Date(end);

    return { startDate: startDate, endDate: endDate, court: resourceId };
  });
};

const dateToYMD = date => {
  const d = date.getDate();
  const dd = new String(d).padStart(2, '0');
  const m = date.getMonth() + 1; //Month from 0 to 11
  const mm = new String(m).padStart(2, '0');
  const y = date.getFullYear();
  return `${y}-${mm}-${dd}`;
};
const run = async () => {
  const today = dateToYMD(new Date()); // today yyyy-mm-dd
  const fortnightAhead = new Date();
  fortnightAhead.setDate(fortnightAhead.getDate() + 15); // Add 15 days because API returns dates before "end"
  const fortnight = dateToYMD(fortnightAhead);
  const params = new URLSearchParams();
  params.set('start', today);
  params.set('end', fortnight);
  const bookings = await scan(params.toString());
  const availableBookings = [];

  for (let court = 1; court <= 12; court++) {
    // 14th day was too noisy
    for (let i = 0; i < 14; i++) {
      if (i === 0 && new Date().getHours() >= 17) {
        // Skip today if after 5pm
        continue;
      }
      if (i === 14 && new Date().getHours() < 17) {
        // Skip the 14 days ahead date if it is before 5pm today (unbookable)
        continue;
      }
      const targetStartDate = new Date(`${today}T17:00`);
      targetStartDate.setDate(targetStartDate.getDate() + i);
      if ([5, 6, 0].includes(targetStartDate.getDay())) {
        // Skip Friday, Saturday, Sunday
        continue;
      }
      const targetEndDate = new Date(targetStartDate);
      targetEndDate.setHours(19);

      const filteredBookings = bookings.filter(
        b =>
          b.court === court &&
          dateToYMD(targetStartDate) === dateToYMD(b.startDate),
      );

      if (!filteredBookings.length) {
        continue;
      }

      const isBooked = filteredBookings.some(b => {
        const targetStartsDuringExistingBooking =
          targetStartDate >= b.startDate && targetStartDate < b.endDate;

        const targetEndsDuringExistingBooking =
          targetEndDate > b.startDate && targetEndDate <= b.endDate;

        const targetWrapsExistingBooking =
          targetStartDate <= b.startDate && targetEndDate >= b.endDate;

        return (
          targetStartsDuringExistingBooking ||
          targetEndsDuringExistingBooking ||
          targetWrapsExistingBooking
        );
      });

      if (!isBooked) {
        availableBookings.push({
          court: court,
          date: targetStartDate,
          dateString: targetStartDate.toLocaleDateString('en-GB', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          }),
        });
      }
    }
  }

  return availableBookings
    .sort((a, b) => {
      if (a.date < b.date) {
        return -1;
      } else if (a.date > b.date) {
        return 1;
      } else {
        return a.court - b.court;
      }
    })
    .map(ab => ({ court: ab.court, date: ab.dateString }));
};

app.get('/', async (_, res) => {
  res.send(await run());
});

app.listen(8388, () => {
  console.log('Server started on port 8388');
});
