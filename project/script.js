const satellites = {}
let objectPosition = null
const ws = new WebSocket('ws://localhost:4001')

const statusDiv = document.getElementById('status')

const layout = {
	title: "Положення Об'єкта та Супутників",
	xaxis: {
		title: 'X (км)',
		zeroline: true,
		showgrid: true,
		gridcolor: '#e0e0e0',
	},
	yaxis: {
		title: 'Y (км)',
		zeroline: true,
		showgrid: true,
		gridcolor: '#e0e0e0',
	},
	showlegend: true,
	width: 800,
	height: 600,
	legend: { x: 0.1, y: 1.1, orientation: 'h' },
	margin: { l: 50, r: 50, b: 50, t: 100 },
}

const data = [
	{
		x: [],
		y: [],
		mode: 'markers',
		type: 'scatter',
		name: 'Супутники',
		marker: { color: 'blue', size: 8, symbol: 'circle' },
		text: [],
		hoverinfo: 'text',
	},
	{
		x: [],
		y: [],
		mode: 'markers',
		type: 'scatter',
		name: "Об'єкт",
		marker: { color: 'red', size: 12, symbol: 'x' },
		text: ["Об'єкт"],
		hoverinfo: 'text',
	},
]

Plotly.newPlot('plot', data, layout)

ws.onopen = () => {
	console.log('Підключено до WebSocket сервера.')
	statusDiv.textContent = 'Підключено до WebSocket сервера.'
}

ws.onmessage = event => {
	const receivedData = JSON.parse(event.data)
	console.log('Отримано дані:', receivedData)

	if (receivedData.id === 'object') {
		if (receivedData.x !== null && receivedData.y !== null) {
			objectPosition = { x: receivedData.x, y: receivedData.y }
			plotData()
		} else {
			console.warn(
				`Некоректні координати для об'єкта: x=${receivedData.x}, y=${receivedData.y}`
			)
		}
	} else if (
		receivedData.x !== null &&
		receivedData.y !== null &&
		receivedData.sentAt !== null &&
		receivedData.receivedAt !== null
	) {
		const signalSpeed = 300000 // км/с
		const timeDiff = (receivedData.receivedAt - receivedData.sentAt) / 1000 // секунди
		const distance = signalSpeed * timeDiff

		satellites[receivedData.id] = {
			x: receivedData.x,
			y: receivedData.y,
			r: distance,
		}

		const satelliteIds = Object.keys(satellites)
		if (satelliteIds.length > 3) {
			delete satellites[satelliteIds[0]]
		}
	} else {
		console.warn(
			`Некоректні дані для супутника ${receivedData.id}:`,
			receivedData
		)
	}

	const validSatellites = Object.values(satellites).filter(
		sat => sat.x !== null && sat.y !== null && sat.r !== null
	)
	if (validSatellites.length === 3) {
		const result = trilaterate(
			validSatellites[0],
			validSatellites[1],
			validSatellites[2]
		)
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

function trilaterate(sat1, sat2, sat3) {
	const { x: x1, y: y1, r: r1 } = sat1
	const { x: x2, y: y2, r: r2 } = sat2
	const { x: x3, y: y3, r: r3 } = sat3

	const A = 2 * (x2 - x1)
	const B = 2 * (y2 - y1)
	const C = r1 ** 2 - r2 ** 2 - x1 ** 2 + x2 ** 2 - y1 ** 2 + y2 ** 2

	const D = 2 * (x3 - x2)
	const E = 2 * (y3 - y2)
	const F = r2 ** 2 - r3 ** 2 - x2 ** 2 + x3 ** 2 - y2 ** 2 + y3 ** 2

	const denominator = A * E - D * B
	if (denominator === 0) {
		console.error('Детермінант рівняння трилатерації дорівнює нулю.')
		return null
	}

	const x = (C * E - F * B) / denominator
	const y = (A * F - D * C) / denominator

	return { x, y }
}

function plotData() {
	const satX = []
	const satY = []
	const satText = []

	Object.entries(satellites)
		.slice(0, 3)
		.forEach(([id, sat]) => {
			satX.push(sat.x)
			satY.push(sat.y)
			satText.push(
				`Супутник ${id}<br>X: ${sat.x.toFixed(2)} км<br>Y: ${sat.y.toFixed(
					2
				)} км`
			)
		})

	const traceSatellites = {
		x: satX,
		y: satY,
		mode: 'markers',
		type: 'scatter',
		name: 'Супутники',
		marker: { color: 'blue', size: 8, symbol: 'circle' },
		text: satText,
		hoverinfo: 'text',
	}

	const traceObject = objectPosition
		? {
				x: [objectPosition.x],
				y: [objectPosition.y],
				mode: 'markers',
				type: 'scatter',
				name: "Об'єкт",
				marker: { color: 'red', size: 12, symbol: 'x' },
				text: [
					`Об'єкт<br>X: ${objectPosition.x.toFixed(
						2
					)} км<br>Y: ${objectPosition.y.toFixed(2)} км`,
				],
				hoverinfo: 'text',
		  }
		: null

	Plotly.react(
		'plot',
		[traceSatellites].concat(traceObject ? [traceObject] : []),
		layout
	)
}
