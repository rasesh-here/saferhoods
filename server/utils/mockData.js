
const users = [
    {
        id: '1',
        email: 'admin@saferhoods.com',
        password: '$2a$10$eCrVpKlGcGltKMJMXyuR5erYXr5Wjb892m2Vu.L9c3XjwVOZjvUty', 
        fullName: 'Admin User',
        role: 'admin',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
    },
    {
        id: '2',
        email: 'responder@saferhoods.com',
        password: '$2a$10$eCrVpKlGcGltKMJMXyuR5erYXr5Wjb892m2Vu.L9c3XjwVOZjvUty', 
        fullName: 'Response Team',
        role: 'responder',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
    },
    {
        id: '3',
        email: 'user@saferhoods.com',
        password: '$2a$10$eCrVpKlGcGltKMJMXyuR5erYXr5Wjb892m2Vu.L9c3XjwVOZjvUty', 
        fullName: 'Regular User',
        role: 'user',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z'
    }
];

const incidents = [
    {
        id: '1',
        title: 'Flooding in Downtown Area',
        description: 'Heavy rainfall has caused flooding in several streets downtown. Multiple homes affected.',
        type: 'Flood',
        status: 'available',
        location: {
            latitude: -33.8688,
            longitude: 151.2093,
            address: 'Downtown, Sydney, NSW, Australia'
        },
        reportedBy: '3',
        reportedAt: '2023-06-01T10:23:54.000Z',
        updatedAt: '2023-06-01T10:23:54.000Z',

        verificationStatus: 'Pending'
    },
    {
        id: '2',
        title: 'Fire in Apartment Building',
        description: 'A fire has broken out in an apartment building on Oak Street. Fire department is on the scene.',
        type: 'Fire',
        status: 'in_progress',
        location: {
            latitude: -33.8712,
            longitude: 151.2045,
            address: 'Oak Street, Sydney, NSW, Australia'
        },
        reportedBy: '3',
        reportedAt: '2023-06-02T14:45:30.000Z',
        updatedAt: '2023-06-02T15:20:12.000Z',

        verificationStatus: 'Confirmed'
    }
];

module.exports = {
    users,
    teams,
    incidents,
    authorities,
}; 