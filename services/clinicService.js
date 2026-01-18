
import fetch from 'node-fetch';

const GUID = '795ab5b1-c687-4248-b3f6-aff091e11b19';
const BASE_API_URL = 'https://dev.startmanager.ro/appointmentsmanager_api/api';

/**
 * Fetch available categories (departments) from API
 */
async function getAvailableCategories() {
    console.log('Step 1: Fetching available categories from API...');
    const url = `${BASE_API_URL}/Categories/getAllByPublicGuid?guid=${GUID}`;
    console.log(`Step 2: API URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API error: ${response.status} - ${errorText}`);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✓ Categories fetched successfully: ${data.length} categories found`);
        
        const formattedCategories = data.map((cat) => ({
            id: cat.id,
            name: cat.name,
        }));
        
        const formattedResponse = {
            categories: formattedCategories,
            summary: `Am gasit ${data.length} sectii disponibile: ${data.map((cat) => cat.name).join(', ')}`
        };
        
        return formattedResponse;
    } catch (error) {
        console.error(`❌ Error fetching categories:`, error);
        throw error;
    }
}

/**
 * Fetch available appointments for a category within date range
 */
async function getAvailableAppointments(categoryId, startDate, endDate) {
    console.log(`Step 1: Fetching available appointments for category ${categoryId}...`);
    console.log(`Step 2: Date range: ${startDate} to ${endDate}`);
    
    const url = `${BASE_API_URL}/AppointmentsSliderPublicForAgent/getAvailableSlotsForAgent/${GUID}/${categoryId}/${startDate}/${endDate}`;
    console.log(`Step 3: API URL: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API error: ${response.status} - ${errorText}`);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✓ Appointments fetched successfully`);
        
        return data;
    } catch (error) {
        console.error(`❌ Error fetching appointments:`, error);
        throw error;
    }
}

/**
 * Create a citizen person record (internal function)
 */
async function createCitizenPerson(patientData) {
    console.log('Sub-step: Creating citizen person...');
    const url = `${BASE_API_URL}/citizenpersons?guid=${GUID}`;
    const apiData = {
        name: patientData.name,
        email: '',
        phone: patientData.phone || '',
        address: '',
        personalIdentificationNumber: patientData.personalIdentificationNumber,
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiData),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API error creating citizen: ${response.status} - ${errorText}`);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✓ Citizen person created successfully with ID: ${data.id}`);
        return data;
    } catch (error) {
        console.error(`❌ Error creating citizen person:`, error);
        throw error;
    }
}

/**
 * Book an appointment by creating the appointment record (internal function)
 */
async function bookAppointmentRecord(appointmentData) {
    console.log('Sub-step: Booking appointment record...');
    const now = new Date();
    const createdDateString = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const payload = {
        appointmentdatestring: appointmentData.appointmentDateString,
        place: appointmentData.place,
        weeklytimeslot: appointmentData.weeklyTimeSlot,
        citizenperson: appointmentData.citizenPerson,
        createddatestring: createdDateString,
        appointmentstatusId: 1,
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
    };
    
    const url = `${BASE_API_URL}/appointmentsslider?guid=${GUID}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`❌ API error booking appointment: ${response.status} - ${errorText}`);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log(`✓ Appointment booked successfully`);
        return data;
    } catch (error) {
        console.error(`❌ Error booking appointment:`, error);
        throw error;
    }
}

/**
 * High-level function exposed as a tool to book an appointment.
 * It orchestrates the creation of a citizen person and the final booking.
 */
async function bookAppointment(details) {
    const { categoryId, patientName, personalIdentificationNumber, phone, appointmentDate, startTime } = details;
    console.log('TOOL: bookAppointment called with details:', details);

    // 1. Create the citizen person record
    const citizenPerson = await createCitizenPerson({
        name: patientName,
        personalIdentificationNumber,
        phone,
    });
    if (!citizenPerson || !citizenPerson.id) {
        throw new Error('A aparut o eroare la inregistrarea datelor pacientului.');
    }

    // 2. Fetch available slots for the given day again to find the full slot object
    const slots = await getAvailableAppointments(categoryId, appointmentDate, appointmentDate);
    
    // Find the specific slot that matches the startTime
    const targetSlot = slots.find(slot => slot.startTime === startTime);

    if (!targetSlot) {
        console.error('Could not find the target slot for booking.', { appointmentDate, startTime });
        throw new Error(`Intervalul orar ${startTime} nu mai este disponibil. Va rugam sa incercati o alta ora.`);
    }

    // 3. Book the appointment using the created person and the full slot details
    const bookingResult = await bookAppointmentRecord({
        appointmentDateString: targetSlot.appointmentDate,
        place: targetSlot.place,
        weeklyTimeSlot: targetSlot.weeklyTimeSlot,
        citizenPerson: citizenPerson,
        startTime: targetSlot.startTime,
        endTime: targetSlot.endTime,
    });

    const confirmationMessage = `Programare finalizata cu succes pentru ${patientName} in data de ${appointmentDate}, ora ${startTime}.`;
    return { success: true, message: confirmationMessage, details: bookingResult };
}

export {
    getAvailableCategories,
    getAvailableAppointments,
    bookAppointment,
};