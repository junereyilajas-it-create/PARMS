import http from 'http'

const data = JSON.stringify({
  propertyType: 'LOT',
  ownerFirstName: 'Test',
  ownerLastName: 'Test',
  ownerBarangay: 'Poblacion',
  ownerMunicipality: 'Lagonglong',
  ownerProvince: 'Misamis Oriental',
  propertyBarangay: 'Poblacion',
  lotArea: '100',
  lotClassification: 'Residential',
  lotStatus: 'active'
})

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/properties/unified',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
}, (res) => {
  let resData = ''
  res.on('data', d => resData += d)
  res.on('end', () => {
    console.log('Status:', res.statusCode)
    console.log('Response:', resData)
  })
})

req.on('error', e => console.error(e))
req.write(data)
req.end()
