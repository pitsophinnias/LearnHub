document.addEventListener('DOMContentLoaded', function() {
    // Sample tutor data for each subject
    const tutors = {
        mathematics: [
            { id: 1, name: "Thabang Ralitjobo", rating: 4.2, experience: "Bsc in Mathematics and Physics", image: "" },
            { id: 2, name: "Mpolai Machesa", rating: 4.8, experience: "Bsc in Biology and Chemistry, A* in Mathematics", image: "" },
            { id: 3, name: "Liabiloe Hlasa", rating: 4.5, experience: "Bsc in Mathematics and Physics, A in Mathematics", image: "" }
        ],
        physics: [
            { id: 1, name: "Thabang Ralitjobo", rating: 4.2, experience: "Bsc in Mathematics and Physics, A in Physical Science", image: "" },
            { id: 3, name: "Liabiloe Hlasa", rating: 4.5, experience: "Bsc in Mathematics and Physics, A* in Physical Science", image: ""}
        ],
        chemistry: [
            { id: 2, name: "Mpolai Machesa", rating: 4.8, experience: "Bsc in Biology and Chemistry, A* in Physical Science", image: "" },
            { id: 1, name: "Thabang Ralitjobo", rating: 4.2, experience: "Bsc in Mathematics and Physics, A in Physical Science", image: "" }
        ],
        biology: [
            { id: 2, name: "Mpolai Machesa", rating: 4.8, experience: "Bsc in Biology and Chemistry, A in Biology", image: "" },
            
        ],
        english: [
            { id: 4, name: "Pitso Pitso", rating: 4.1, experience: "B.Eng in Computer Systems and Networks, A* in English Literature", image: "" },
            { id: 5, name: "Lebusa Molibeli", rating: 4.0, experience: "Bsc in Urban and Regional Planning, A* in English Literature", image: "" }
        ],
        ict: [
            { id: 4, name: "Pitso Pitso", rating: 4.1, experience: "B.Eng in Computer Systems and Networks, A in ICT", image: "" },
            { id: 6, name: "Qebe Qebe", rating: 4.1, experience: "Economics, A* in ICT", image: "" }
        ],
        design: [
            { id: 6, name: "Qebe Qebe", rating: 4.1, experience: "Economics, A* in Design & Technology", image: "" },
            { id: 1, name: "Thabang Ralitjobo", rating: 4.2, experience: "Bsc in Mathematics and Physics, A* in Design & Technology", image: "" },
            { id: 5, name: "Lebusa Molibeli", rating: 4.0, experience: "Bsc in Urban and Regional Planning, A* in Design & Technology", image: ""},
            { id: 4, name: "Pitso Pitso", rating: 4.1, experience: "B.Eng in Computer Systems and Networks, A* in Design & Technology", image: "" },
            { id: 3, name: "Liabiloe Hlasa", rating: 4.5, experience: "Bsc in Mathematics and Physics, A* in Design & Technology", image: ""}

        ]
    };

    // Get DOM elements
    const subjectCards = document.querySelectorAll('.subject-card');
    const modal = document.getElementById('selection-modal');
    const closeBtn = document.querySelector('.close-btn');
    const modalTitle = document.getElementById('modal-title');
    const tutorList = document.getElementById('tutor-list');
    const confirmBookingBtn = document.getElementById('confirm-booking');
    const contactForm = document.getElementById('contact-form');

    // Current selected subject
    let currentSubject = null;

    // Add click event to subject cards
    subjectCards.forEach(card => {
        card.addEventListener('click', function(e) {
            // Don't trigger if clicking on the button (let button handle it)
            if (e.target.classList.contains('select-btn')) return;
            
            const subject = this.getAttribute('data-subject');
            showTutors(subject);
        });
    });

    // Add click event to select buttons
    document.querySelectorAll('.select-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent card click event
            const subject = this.closest('.subject-card').getAttribute('data-subject');
            showTutors(subject);
        });
    });

    // Close modal when clicking X
    closeBtn.addEventListener('click', function() {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Confirm booking button
    confirmBookingBtn.addEventListener('click', function() {
        const selectedTutor = document.querySelector('input[name="tutor"]:checked');
        const schedule = document.getElementById('schedule').value;
        
        if (!selectedTutor) {
            alert('Please select a tutor');
            return;
        }
        
        if (!schedule) {
            alert('Please select a date and time');
            return;
        }
        
        const tutorId = selectedTutor.value;
        const tutorName = selectedTutor.closest('.tutor-card').querySelector('h4').textContent;
        
        alert(`Booking confirmed!\n\nTutor: ${tutorName}\nSubject: ${currentSubject}\nDate: ${new Date(schedule).toLocaleString()}`);
        
        modal.style.display = 'none';
    });

    // Contact form submission
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const message = document.getElementById('message').value;
        
        // Here you would typically send this data to a server
        console.log('Contact form submitted:', { name, email, message });
        
        alert('Thank you for your message! We will get back to you soon.');
        contactForm.reset();
    });

    // Function to show tutors for a subject
    function showTutors(subject) {
        currentSubject = subject;
        const subjectTutors = tutors[subject];
        
        if (!subjectTutors || subjectTutors.length === 0) {
            tutorList.innerHTML = '<p>No tutors available for this subject at the moment.</p>';
        } else {
            // Capitalize first letter of subject
            const subjectName = subject.charAt(0).toUpperCase() + subject.slice(1);
            if (subject === 'ict') subjectName = 'ICT';
            else if (subject === 'design') subjectName = 'Design & Technology';
            
            modalTitle.textContent = `Select Your ${subjectName} Tutor`;
            
            tutorList.innerHTML = '';
            
            subjectTutors.forEach(tutor => {
                const tutorCard = document.createElement('div');
                tutorCard.className = 'tutor-card';
                tutorCard.innerHTML = `
                    <img src="${tutor.image}" alt="${tutor.name}">
                    <div class="tutor-info">
                        <h4>${tutor.name}</h4>
                        <p>${tutor.experience}</p>
                    </div>
                    <div class="tutor-rating">
                        <i class="fas fa-star"></i> ${tutor.rating}
                    </div>
                    <input type="radio" name="tutor" value="${tutor.id}" style="margin-left: 15px;">
                `;
                tutorList.appendChild(tutorCard);
            });
        }
        
        modal.style.display = 'block';
    }

    // Exam dates data
const examDates = [
    { subject: "Mathematics", date: "2025-10-10" },
    { subject: "Physics", date: "2025-10-14" },
    { subject: "Chemistry", date: "2025-10-18" },
    { subject: "Biology", date: "2025-10-22" },
    { subject: "English Literature", date: "2025-10-26" },
    { subject: "ICT", date: "2025-10-30" },
    { subject: "Design & Technology", date: "2025-11-04" }
];

// Set the next exam date (first one in the array)
const nextExamDate = new Date(examDates[0].date);
document.getElementById('next-exam-date').textContent = nextExamDate.toLocaleDateString('en-US', { 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
});

// Countdown timer
function updateCountdown() {
    const now = new Date();
    const diff = nextExamDate - now;
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    document.getElementById('days').textContent = days.toString().padStart(2, '0');
    document.getElementById('hours').textContent = hours.toString().padStart(2, '0');
    document.getElementById('minutes').textContent = minutes.toString().padStart(2, '0');
    document.getElementById('seconds').textContent = seconds.toString().padStart(2, '0');
    
    if (diff < 0) {
        clearInterval(countdownInterval);
        document.querySelector('.countdown-container h3').textContent = "Final Exams Have Started!";
    }
}

// Initialize countdown
updateCountdown();
const countdownInterval = setInterval(updateCountdown, 1000);

// Calendar functionality
// Calendar functionality
let currentMonth = new Date(examDates[0].date).getMonth(); 
let currentYear = new Date(examDates[0].date).getFullYear(); 
function renderCalendar() {
    const monthNames = ["January", "February", "March", "April", "May", "June",
                       "July", "August", "September", "October", "November", "December"];
    
    document.getElementById('current-month').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    const calendarDays = document.getElementById('calendar-days');
    calendarDays.innerHTML = '';
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
        const dayElement = document.createElement('div');
        dayElement.className = 'prev-month';
        dayElement.textContent = daysInPrevMonth - i;
        calendarDays.appendChild(dayElement);
    }
    
    // Current month days
    const today = new Date();
    for (let i = 1; i <= daysInMonth; i++) {
        const dayElement = document.createElement('div');
        dayElement.textContent = i;
        
        // Highlight today
        if (i === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear()) {
            dayElement.classList.add('today');
        }
        
        // Highlight exam days
        examDates.forEach(exam => {
            const examDate = new Date(exam.date);
            if (i === examDate.getDate() && currentMonth === examDate.getMonth() && currentYear === examDate.getFullYear()) {
                dayElement.classList.add('exam-day');
                dayElement.title = exam.subject + " Exam";
            }
        });
        
        calendarDays.appendChild(dayElement);
    }
    
    // Next month days
    const totalCells = firstDay + daysInMonth;
    const nextMonthDays = totalCells <= 35 ? 35 - totalCells : 42 - totalCells;
    
    for (let i = 1; i <= nextMonthDays; i++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'next-month';
        dayElement.textContent = i;
        calendarDays.appendChild(dayElement);
    }
}

// Navigation buttons
document.getElementById('prev-month').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    renderCalendar();
});

document.getElementById('next-month').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    renderCalendar();
});

// Initialize calendar
renderCalendar();
    // Smooth scrolling for navigation links
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            window.scrollTo({
                top: targetElement.offsetTop - 70,
                behavior: 'smooth'
            });
        });
    });
});
