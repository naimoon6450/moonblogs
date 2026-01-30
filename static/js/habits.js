(function() {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  let currentYear = null;
  const tooltip = document.getElementById('tooltip');

  function getWeeksInYear(year) {
    const weeks = [];
    year = parseInt(year, 10);
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const startDay = startDate.getDay();
    if (startDay !== 0) {
      const firstWeek = [];
      for (let i = 0; i < startDay; i++) {
        firstWeek.push(null);
      }
      for (let i = startDay; i < 7; i++) {
        const d = new Date(year, 0, 1 + (i - startDay));
        firstWeek.push(d);
      }
      weeks.push(firstWeek);
    }

    let currentDate = new Date(year, 0, 1);
    if (startDay !== 0) {
      currentDate = new Date(year, 0, 1 + (7 - startDay));
    }

    while (currentDate <= endDate) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        if (currentDate > endDate) {
          week.push(null);
        } else if (currentDate.getFullYear() !== year) {
          week.push(null);
        } else {
          week.push(new Date(currentDate));
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatDisplayDate(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  function isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  function isFuture(date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date > today;
  }

  function renderGraph(containerId, dates, year) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';

    const dateSet = new Set(dates || []);
    const weeks = getWeeksInYear(year);

    const wrapper = document.createElement('div');
    wrapper.className = 'graph-wrapper';

    const monthLabels = document.createElement('div');
    monthLabels.className = 'month-labels';

    let currentMonth = -1;
    weeks.forEach((week, weekIndex) => {
      week.forEach(day => {
        if (day && day.getMonth() !== currentMonth) {
          const label = document.createElement('span');
          label.className = 'month-label';
          label.textContent = MONTHS[day.getMonth()];
          label.style.left = `${weekIndex * 13}px`;
          monthLabels.appendChild(label);
          currentMonth = day.getMonth();
        }
      });
    });

    wrapper.appendChild(monthLabels);

    const graphBody = document.createElement('div');
    graphBody.className = 'graph-body';

    const dayLabels = document.createElement('div');
    dayLabels.className = 'day-labels';
    [1, 3, 5].forEach(i => {
      const label = document.createElement('div');
      label.className = 'day-label';
      label.textContent = DAYS[i];
      label.style.marginTop = i === 1 ? '11px' : '11px';
      dayLabels.appendChild(label);
    });
    graphBody.appendChild(dayLabels);

    const weeksContainer = document.createElement('div');
    weeksContainer.className = 'weeks-container';

    weeks.forEach(week => {
      const weekCol = document.createElement('div');
      weekCol.className = 'week-column';

      week.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'day-cell';

        if (day) {
          const dateStr = formatDate(day);
          const hasActivity = dateSet.has(dateStr);

          if (isFuture(day)) {
            cell.classList.add('future');
          } else if (hasActivity) {
            cell.classList.add('level-2');
          } else {
            cell.classList.add('level-0');
          }

          if (isToday(day)) {
            cell.classList.add('today');
          }

          cell.dataset.date = dateStr;
          cell.dataset.display = formatDisplayDate(day);
          cell.dataset.completed = hasActivity ? 'yes' : 'no';

          cell.addEventListener('mouseenter', showTooltip);
          cell.addEventListener('mouseleave', hideTooltip);
        }

        weekCol.appendChild(cell);
      });

      weeksContainer.appendChild(weekCol);
    });

    graphBody.appendChild(weeksContainer);
    wrapper.appendChild(graphBody);
    container.appendChild(wrapper);
  }

  function renderRollupGraph(year) {
    const container = document.getElementById('rollup-graph');
    if (!container) return;

    container.innerHTML = '';

    const yearData = habitsData[year] || {};
    const allDates = new Map();

    Object.values(yearData).forEach(dates => {
      (dates || []).forEach(date => {
        allDates.set(date, (allDates.get(date) || 0) + 1);
      });
    });

    const weeks = getWeeksInYear(year);

    const wrapper = document.createElement('div');
    wrapper.className = 'graph-wrapper';

    const monthLabels = document.createElement('div');
    monthLabels.className = 'month-labels';

    let currentMonth = -1;
    weeks.forEach((week, weekIndex) => {
      week.forEach(day => {
        if (day && day.getMonth() !== currentMonth) {
          const label = document.createElement('span');
          label.className = 'month-label';
          label.textContent = MONTHS[day.getMonth()];
          label.style.left = `${weekIndex * 13}px`;
          monthLabels.appendChild(label);
          currentMonth = day.getMonth();
        }
      });
    });

    wrapper.appendChild(monthLabels);

    const graphBody = document.createElement('div');
    graphBody.className = 'graph-body';

    const dayLabels = document.createElement('div');
    dayLabels.className = 'day-labels';
    [1, 3, 5].forEach(i => {
      const label = document.createElement('div');
      label.className = 'day-label';
      label.textContent = DAYS[i];
      label.style.marginTop = i === 1 ? '11px' : '11px';
      dayLabels.appendChild(label);
    });
    graphBody.appendChild(dayLabels);

    const weeksContainer = document.createElement('div');
    weeksContainer.className = 'weeks-container';

    weeks.forEach(week => {
      const weekCol = document.createElement('div');
      weekCol.className = 'week-column';

      week.forEach(day => {
        const cell = document.createElement('div');
        cell.className = 'day-cell';

        if (day) {
          const dateStr = formatDate(day);
          const count = allDates.get(dateStr) || 0;

          if (isFuture(day)) {
            cell.classList.add('future');
          } else if (count === 0) {
            cell.classList.add('level-0');
          } else if (count === 1) {
            cell.classList.add('level-1');
          } else if (count === 2) {
            cell.classList.add('level-2');
          } else if (count <= 4) {
            cell.classList.add('level-3');
          } else {
            cell.classList.add('level-4');
          }

          if (isToday(day)) {
            cell.classList.add('today');
          }

          cell.dataset.date = dateStr;
          cell.dataset.display = formatDisplayDate(day);
          cell.dataset.count = count;

          cell.addEventListener('mouseenter', showRollupTooltip);
          cell.addEventListener('mouseleave', hideTooltip);
        }

        weekCol.appendChild(cell);
      });

      weeksContainer.appendChild(weekCol);
    });

    graphBody.appendChild(weeksContainer);
    wrapper.appendChild(graphBody);
    container.appendChild(wrapper);
  }

  function showTooltip(e) {
    const cell = e.target;
    const completed = cell.dataset.completed === 'yes';
    tooltip.textContent = `${cell.dataset.display} - ${completed ? 'Completed' : 'Not completed'}`;
    positionTooltip(e);
    tooltip.classList.add('visible');
  }

  function showRollupTooltip(e) {
    const cell = e.target;
    const count = parseInt(cell.dataset.count) || 0;
    tooltip.textContent = `${cell.dataset.display} - ${count} habit${count !== 1 ? 's' : ''} completed`;
    positionTooltip(e);
    tooltip.classList.add('visible');
  }

  function positionTooltip(e) {
    const rect = e.target.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 30}px`;
    tooltip.style.transform = 'translateX(-50%)';
  }

  function hideTooltip() {
    tooltip.classList.remove('visible');
  }

  function switchYear(year) {
    currentYear = year;

    document.querySelectorAll('.year-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.year === year);
    });

    const yearData = habitsData[year] || {};

    renderRollupGraph(year);
    renderGraph('meditation-graph', yearData.meditation, year);
    renderGraph('journaling-graph', yearData.journaling, year);
    renderGraph('writing-graph', yearData.writing, year);
    renderGraph('exercise-graph', yearData.exercise, year);
    renderGraph('reading-graph', yearData.reading, year);
  }

  function init() {
    const years = Object.keys(habitsData).sort();
    const latestYear = years[years.length - 1] || new Date().getFullYear().toString();

    document.querySelectorAll('.year-btn').forEach(btn => {
      btn.addEventListener('click', () => switchYear(btn.dataset.year));
    });

    switchYear(latestYear);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
