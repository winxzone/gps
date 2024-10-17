const socket = new WebSocket('ws://localhost:4001')
const satelliteData = {}
const objectData = {}
const maxStaleTime = 1000
const lastUpdateTime = {}
const boundaries = { x: [0, 120], y: [0, 120] }

socket.onmessage = function (event) {
	const message = JSON.parse(event.data)
	console.log('Received message:', message)

	const currentTime = Date.now()

	// Обновляем спутники
	satelliteData[message.id] = { x: message.x, y: message.y }
	lastUpdateTime[message.id] = currentTime

	removeStalePoints(currentTime)
	calculateObjectPosition()
	updatePlot()
}

function removeStalePoints(currentTime) {
	Object.keys(satelliteData).forEach(id => {
		if (currentTime - lastUpdateTime[id] > maxStaleTime) {
			delete satelliteData[id]
			delete lastUpdateTime[id]
		}
	})
}

function calculateObjectPosition() {
	const satelliteArray = Object.values(satelliteData)

	if (satelliteArray.length >= 3) {
		const [sat1, sat2, sat3] = satelliteArray.slice(0, 3) // берём 3 спутника

		const avgX = (sat1.x + sat2.x + sat3.x) / 3 // тут среднее положение но осям
		const avgY = (sat1.y + sat2.y + sat3.y) / 3

		console.log(`Calculated object position: x=${avgX}, y=${avgY}`)

		if (
			avgX >= boundaries.x[0] &&
			avgX <= boundaries.x[1] &&
			avgY >= boundaries.y[0] &&
			avgY <= boundaries.y[1]
		) {
			objectData.x = avgX
			objectData.y = avgY
		} else {
			objectData.x = undefined
			objectData.y = undefined
		}
	} else {
		console.log('Not enough satellites for determining object position')
	}
}

function updatePlot() {
	const satelliteArray = Object.values(satelliteData)

	const satelliteTrace = {
		x: satelliteArray.map(d => d.x),
		y: satelliteArray.map(d => d.y),
		mode: 'markers',
		type: 'scatter',
		name: 'Спутники',
		marker: { size: 8, color: 'blue' },
	}

	const objectTrace = {
		x: objectData.x !== undefined ? [objectData.x] : [],
		y: objectData.y !== undefined ? [objectData.y] : [],
		mode: 'markers',
		type: 'scatter',
		name: 'Обьект',
		marker: { size: 12, color: 'red' },
	}

	const layout = {
		title: 'GPS Emulation Viewer',
		xaxis: {
			title: 'X',
			range: boundaries.x,
		},
		yaxis: {
			title: 'Y',
			range: boundaries.y,
		},
		showlegend: true,
	}

	Plotly.newPlot('plot', [satelliteTrace, objectTrace], layout)
}
