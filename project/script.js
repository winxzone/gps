// Параметри відомих точок (супутників)
const satellites = {}

// Координати об'єкта
let objectPosition = null

// Підключення до WebSocket сервера
const ws = new WebSocket('ws://localhost:4001') // Заміни URL при необхідності

const statusDiv = document.getElementById('status')
const configForm = document.getElementById('config-form')
const configStatusDiv = document.getElementById('config-status')

// Ініціалізація графіку
const layout = {
	title: "Положення Об'єкта та Супутників",
	xaxis: { title: 'X (км)' },
	yaxis: { title: 'Y (км)' },
	showlegend: true,
	width: 800,
	height: 600,
}

// Початкові дані для графіку
const data = [
	{
		x: [],
		y: [],
		mode: 'markers',
		type: 'scatter',
		name: 'Супутники',
		marker: { color: 'blue', size: 8 },
	},
	{
		x: [],
		y: [],
		mode: 'markers',
		type: 'scatter',
		name: "Об'єкт",
		marker: { color: 'red', size: 12, symbol: 'x' },
	},
]

Plotly.newPlot('plot', data, layout)

// Обробка подій WebSocket
ws.onopen = () => {
	console.log('Підключено до WebSocket сервера.')
	statusDiv.textContent = 'Підключено до WebSocket сервера.'
}

ws.onmessage = event => {
	const data = JSON.parse(event.data)
	console.log('Отримано дані:', data)

	// Перевірка, чи це повідомлення від об'єкта чи супутника
	if (data.id === 'object') {
		objectPosition = { x: data.x, y: data.y }
	} else {
		// Обчислення відстані до об'єкта (r) на основі часу відправки та отримання
		// Швидкість сигналу світла в повітрі ~300000 км/с
		const signalSpeed = 300000 // км/с
		const timeDiff = (data.receivedAt - data.sentAt) / 1000 // секунди
		const distance = signalSpeed * timeDiff // км

		satellites[data.id] = { x: data.x, y: data.y, r: distance }
	}

	// Якщо зібрано дані від трьох супутників, виконуємо трилатерацію
	if (Object.keys(satellites).length >= 3) {
		const satArray = Object.values(satellites).slice(0, 3)
		const result = trilaterate(satArray[0], satArray[1], satArray[2])

		if (result) {
			objectPosition = { x: result.x, y: result.y }
			plotData()
		} else {
			console.error("Не вдалося визначити позицію об'єкта.")
		}
	}
}

ws.onclose = () => {
	console.log('Відключено від WebSocket сервера.')
	statusDiv.textContent = 'Відключено від WebSocket сервера.'
}

ws.onerror = error => {
	console.error('WebSocket помилка:', error)
	statusDiv.textContent = 'Помилка підключення до WebSocket сервера.'
}

// Функція трилатерації
function trilaterate(sat1, sat2, sat3) {
	const { x: x1, y: y1, r: r1 } = sat1
	const { x: x2, y: y2, r: r2 } = sat2
	const { x: x3, y: y3, r: r3 } = sat3

	// Переведення рівнянь кіл до лінійного вигляду
	const A = 2 * (x2 - x1)
	const B = 2 * (y2 - y1)
	const C = r1 ** 2 - r2 ** 2 - x1 ** 2 + x2 ** 2 - y1 ** 2 + y2 ** 2

	const D = 2 * (x3 - x2)
	const E = 2 * (y3 - y2)
	const F = r2 ** 2 - r3 ** 2 - x2 ** 2 + x3 ** 2 - y2 ** 2 + y3 ** 2

	// Обчислення детермінанту
	const denominator = A * E - D * B
	if (denominator === 0) {
		console.error('Детермінант рівняння трилатерації дорівнює нулю.')
		return null
	}

	const x = (C * E - F * B) / denominator
	const y = (A * F - D * C) / denominator

	return { x, y }
}

// Функція для відображення даних на графіку
function plotData() {
	const satX = []
	const satY = []

	for (const sat of Object.values(satellites)) {
		satX.push(sat.x)
		satY.push(sat.y)
	}

	const traceSatellites = {
		x: satX,
		y: satY,
		mode: 'markers',
		type: 'scatter',
		name: 'Супутники',
		marker: { color: 'blue', size: 8 },
	}

	let traceObject = {}
	if (objectPosition) {
		traceObject = {
			x: [objectPosition.x],
			y: [objectPosition.y],
			mode: 'markers',
			type: 'scatter',
			name: "Об'єкт",
			marker: { color: 'red', size: 12, symbol: 'x' },
		}
	}

	const update = {
		x: [traceSatellites.x, traceObject.x],
		y: [traceSatellites.y, traceObject.y],
	}

	Plotly.react('plot', [traceSatellites, traceObject], layout)
}

// Обробка форми для зміни параметрів GPS
configForm.addEventListener('submit', e => {
	e.preventDefault()

	const emulationZoneSize = document.getElementById('emulationZoneSize').value
	const messageFrequency = document.getElementById('messageFrequency').value
	const satelliteSpeed = document.getElementById('satelliteSpeed').value
	const objectSpeed = document.getElementById('objectSpeed').value

	const configData = {
		emulationZoneSize: emulationZoneSize,
		messageFrequency: parseInt(messageFrequency),
		satelliteSpeed: parseInt(satelliteSpeed),
		objectSpeed: parseInt(objectSpeed),
	}

	// Відправка POST запиту до API для зміни параметрів
	fetch('http://localhost:4001/config', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(configData),
	})
		.then(response => {
			if (response.ok) {
				configStatusDiv.textContent = 'Налаштування успішно застосовано.'
				configStatusDiv.style.color = 'green'
			} else {
				throw new Error('Помилка при застосуванні налаштувань.')
			}
		})
		.catch(error => {
			console.error('Помилка:', error)
			configStatusDiv.textContent = 'Не вдалося застосувати налаштування.'
			configStatusDiv.style.color = 'red'
		})
})
