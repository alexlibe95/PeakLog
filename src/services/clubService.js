import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const clubService = {
  async listClubs() {
    const clubsRef = collection(db, 'clubs');
    const snapshot = await getDocs(clubsRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async createClub(name) {
    const clubsRef = collection(db, 'clubs');
    const docRef = await addDoc(clubsRef, {
      name,
      nameLower: name.toLowerCase(),
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return docRef.id;
  },

  async renameClub(clubId, newName) {
    const ref = doc(db, 'clubs', clubId);
    await updateDoc(ref, { name: newName, nameLower: newName.toLowerCase(), updatedAt: new Date().toISOString() });
  },

  async deactivateClub(clubId) {
    const ref = doc(db, 'clubs', clubId);
    await updateDoc(ref, { status: 'inactive', updatedAt: new Date().toISOString() });
  },

  async activateClub(clubId) {
    const ref = doc(db, 'clubs', clubId);
    await updateDoc(ref, { status: 'active', updatedAt: new Date().toISOString() });
  },

  async deleteClub(clubId) {
    const batch = writeBatch(db);

    try {
      // Delete club document
      const clubRef = doc(db, 'clubs', clubId);
      batch.delete(clubRef);

      // Delete all memberships for this club
      const membershipsRef = collection(db, 'clubs', clubId, 'members');
      const membershipsSnapshot = await getDocs(membershipsRef);
      membershipsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete all training programs for this club
      const programsRef = collection(db, 'clubs', clubId, 'programs');
      const programsSnapshot = await getDocs(programsRef);
      programsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete weekly schedule
      const scheduleRef = doc(db, 'clubs', clubId, 'settings', 'weeklySchedule');
      batch.delete(scheduleRef);

      // Delete all training sessions and attendance records
      const sessionsRef = collection(db, 'clubs', clubId, 'sessions');
      const sessionsSnapshot = await getDocs(sessionsRef);
      sessionsSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Delete attendance records
      const attendanceRef = collection(db, 'clubs', clubId, 'attendance');
      const attendanceSnapshot = await getDocs(attendanceRef);
      attendanceSnapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      // Commit all deletions
      await batch.commit();

      // console.log removed(`Club ${clubId} and all related data deleted successfully`);
    } catch (error) {
      console.error('Error deleting club:', error);
      throw new Error(`Failed to delete club: ${error.message}`);
    }
  },

  async listAdmins(clubId) {
    const membersRef = collection(db, 'clubs', clubId, 'members');
    const snapshot = await getDocs(membersRef);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((m) => m.role === 'admin');
  },

  async listMembers(clubId) {
    const membersRef = collection(db, 'clubs', clubId, 'members');
    const snapshot = await getDocs(membersRef);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async getUserMemberships(userId) {
    // Get all club memberships for a user
    const memberships = [];
    const clubs = await this.listClubs();

    for (const club of clubs) {
      const memberRef = doc(db, 'clubs', club.id, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      if (memberSnap.exists()) {
        memberships.push({
          clubId: club.id,
          clubName: club.name,
          role: memberSnap.data().role,
          joinedAt: memberSnap.data().joinedAt,
          status: memberSnap.data().status || 'active'
        });
      }
    }
    return memberships;
  },

  async assignAdminByEmail(clubId, email) {
    // Check if user exists in the system
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', email));
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      // User exists, assign directly
      const userDoc = userSnapshot.docs[0];
      const userId = userDoc.id;
      return await this.assignAdminByUserId(clubId, userId);
    } else {
      // User doesn't exist, just store the email for future assignment
      // When user registers, AuthContext will check for pending assignments
      const assignmentRef = doc(db, 'clubs', clubId, 'pendingAssignments', email.replace('.', '_'));
      await setDoc(assignmentRef, {
        email,
        role: 'admin',
        assignedAt: new Date().toISOString(),
        status: 'pending'
      });
      return true;
    }
  },

  async assignAdminByUserId(clubId, userId) {
    // Add user as admin to club
    const batch = writeBatch(db);

    // Add membership
    const memberRef = doc(db, 'clubs', clubId, 'members', userId);
    batch.set(memberRef, {
      role: 'admin',
      status: 'active',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update user profile to include admin role for this club
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      memberships: arrayUnion({
        clubId,
        role: 'admin',
        joinedAt: new Date().toISOString()
      }),
      updatedAt: new Date().toISOString()
    });

    await batch.commit();
    return true;
  },

  async assignAthleteByUserId(clubId, userId) {
    // Add user as athlete to club
    const batch = writeBatch(db);

    // Add membership
    const memberRef = doc(db, 'clubs', clubId, 'members', userId);
    batch.set(memberRef, {
      role: 'athlete',
      status: 'active',
      joinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Update user profile to include athlete role for this club
    const userRef = doc(db, 'users', userId);
    batch.update(userRef, {
      memberships: arrayUnion({
        clubId,
        role: 'athlete',
        joinedAt: new Date().toISOString()
      }),
      updatedAt: new Date().toISOString()
    });

    await batch.commit();
    return true;
  },

  async removeAdmin(clubId, uid) {
    // Remove admin role from user in this club
    const batch = writeBatch(db);

    // First update user profile to remove this membership (while permissions still work)
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const memberships = userSnap.data().memberships || [];
      const updatedMemberships = memberships.filter(m => m.clubId !== clubId);
      batch.update(userRef, {
        memberships: updatedMemberships,
        updatedAt: new Date().toISOString()
      });
    }

    // Then remove membership document
    const memberRef = doc(db, 'clubs', clubId, 'members', uid);
    batch.delete(memberRef);

    await batch.commit();
  },

  async removeAthlete(clubId, uid) {
    // Remove athlete role from user in this club
    const batch = writeBatch(db);

    // First update user profile to remove this membership (while permissions still work)
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const memberships = userSnap.data().memberships || [];
      const updatedMemberships = memberships.filter(m => m.clubId !== clubId);
      batch.update(userRef, {
        memberships: updatedMemberships,
        updatedAt: new Date().toISOString()
      });
    }

    // Then remove membership document
    const memberRef = doc(db, 'clubs', clubId, 'members', uid);
    batch.delete(memberRef);

    await batch.commit();
  },

  async changeUserRole(clubId, userId, newRole) {
    // Change user's role in a specific club
    const batch = writeBatch(db);

    // Update membership role
    const memberRef = doc(db, 'clubs', clubId, 'members', userId);
    batch.update(memberRef, {
      role: newRole,
      updatedAt: new Date().toISOString()
    });

    // Update user profile membership role
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const memberships = userSnap.data().memberships || [];
      const updatedMemberships = memberships.map(m =>
        m.clubId === clubId ? { ...m, role: newRole } : m
      );
      batch.update(userRef, {
        memberships: updatedMemberships,
        updatedAt: new Date().toISOString()
      });
    }

    await batch.commit();
  },

  async getClubMembersWithDetails(clubId) {
    const members = await this.listMembers(clubId);
    const membersWithDetails = [];

    for (const member of members) {
      try {
        const userSnap = await getDoc(doc(db, 'users', member.id));
        if (userSnap.exists()) {
          const userData = userSnap.data();
          membersWithDetails.push({
            ...member,
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            sport: userData.sport
          });
        } else {
          membersWithDetails.push(member);
        }
      } catch (error) {
        console.error('Error fetching user details for member:', member.id, error);
        membersWithDetails.push(member);
      }
    }

    return membersWithDetails;
  },

  // Invites
  _generateToken(length = 40) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }
    return token;
  },

  async assignAthleteByEmail(clubId, email) {
    // Check if user exists in the system
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', email));
    const userSnapshot = await getDocs(userQuery);

    if (!userSnapshot.empty) {
      // User exists, assign directly
      const userDoc = userSnapshot.docs[0];
      const userId = userDoc.id;
      return await this.assignAthleteByUserId(clubId, userId);
    } else {
      // User doesn't exist, store the email for future assignment
      const assignmentRef = doc(db, 'clubs', clubId, 'pendingAssignments', email.replace('.', '_'));
      await setDoc(assignmentRef, {
        email,
        role: 'athlete',
        assignedAt: new Date().toISOString(),
        status: 'pending'
      });
      return true;
    }
  },

  async listInvites(clubId) {
    const ref = collection(db, 'clubs', clubId, 'invites');
    const snap = await getDocs(ref);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  },

  async revokeInvite(clubId, inviteId) {
    const ref = doc(db, 'clubs', clubId, 'invites', inviteId);
    const inv = await getDoc(ref);
    if (!inv.exists()) return;
    // Prefer deleting pending invites to remove clutter
    await deleteDoc(ref);
  },

  async clubNameExists(name, excludeId = null) {
    const lowered = name.trim().toLowerCase();
    if (!lowered) return false;
    const clubsRef = collection(db, 'clubs');
    const snap = await getDocs(query(clubsRef, where('nameLower', '==', lowered)));
    if (snap.empty) return false;
    // If any doc is not the excluded one, it exists
    return snap.docs.some((d) => d.id !== excludeId);
  },

  // Training Program Management
  async createTrainingProgram(clubId, programData) {
    try {
      const programRef = doc(collection(db, 'trainingPrograms'));
      const program = {
        id: programRef.id,
        clubId,
        name: programData.name,
        description: programData.description || '',
        objectives: programData.objectives || '',
        difficulty: programData.difficulty || 'beginner',
        duration: programData.duration || '',
        equipment: programData.equipment || '',
        preparationTips: programData.preparationTips || '',
        targetSkills: programData.targetSkills || '',
        specialInstructions: programData.specialInstructions || '',
        schedule: programData.schedule, // Array of training days
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: programData.createdBy,
        isActive: true
      };

      await setDoc(programRef, program);
      // console.log removed('✅ Training program created successfully:', program.name);
      return program;
    } catch (error) {
      console.error('❌ Error creating training program:', error);
      throw error;
    }
  },

  // Weekly Schedule Management
  async saveWeeklySchedule(clubId, scheduleData, userId) {
    try {
      const scheduleRef = doc(db, 'clubs', clubId, 'settings', 'weeklySchedule');
      const schedule = {
        clubId,
        schedule: scheduleData, // Object with days of week and their settings
        updatedAt: new Date(),
        updatedBy: userId
      };

      await setDoc(scheduleRef, schedule);
      // console.log removed('✅ Weekly schedule saved successfully');
      return schedule;
    } catch (error) {
      console.error('❌ Error saving weekly schedule:', error);
      throw error;
    }
  },

  async getWeeklySchedule(clubId) {
    try {
      const scheduleRef = doc(db, 'clubs', clubId, 'settings', 'weeklySchedule');
      const scheduleSnap = await getDoc(scheduleRef);

      if (scheduleSnap.exists()) {
        return scheduleSnap.data();
      } else {
        // Return default schedule if none exists
        return {
          clubId,
          schedule: {
            monday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
            tuesday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
            wednesday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
            thursday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
            friday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
            saturday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' },
            sunday: { enabled: false, startTime: '09:00', endTime: '10:30', programId: 'none' }
          },
          updatedAt: null,
          updatedBy: null
        };
      }
    } catch (error) {
      console.error('❌ Error fetching weekly schedule:', error);
      throw error;
    }
  },

  async getUpcomingTrainingDays(clubId, limitCount = 14) {
    try {
      // Get the weekly schedule
      const weeklySchedule = await this.getWeeklySchedule(clubId);

      const days = [];
      const today = new Date();

      // Get enabled days from weekly schedule (if it exists)
      let enabledDays = [];
      if (weeklySchedule && weeklySchedule.schedule) {
        enabledDays = Object.entries(weeklySchedule.schedule)
          .filter(([, dayData]) => dayData.enabled)
          .map(([dayKey, dayData]) => ({
            dayKey,
            ...dayData,
            dayIndex: this._getDayIndex(dayKey)
          }));
      }

      // Always get existing training sessions (both from schedule and manually assigned)
      let existingSessions = [];
      try {
        const sessionsQuery = query(
          collection(db, 'trainingSessions'),
          where('clubId', '==', clubId),
          orderBy('date', 'asc')
        );
        const sessionsSnap = await getDocs(sessionsQuery);
        existingSessions = sessionsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          date: doc.data().date?.toDate?.() || doc.data().date,
          fromSchedule: doc.data().isFromSchedule || false
        }));
      } catch (error) {
        console.error('Error fetching existing training sessions:', error);
      }

      // If no enabled days in schedule and no existing sessions, return empty
      if (enabledDays.length === 0 && existingSessions.length === 0) {
        return [];
      }

      // Generate next occurrences of enabled days (from weekly schedule)
      let scheduleDaysFound = 0;
      let currentDate = new Date(today);

      // First, collect all days from existing sessions
      const sessionDays = new Map();

      existingSessions.forEach(session => {
        if (session.date >= today) {
          const dateKey = session.date.toISOString().split('T')[0];
          if (!sessionDays.has(dateKey)) {
            sessionDays.set(dateKey, {
              date: session.date,
              sessions: []
            });
          }
          sessionDays.get(dateKey).sessions.push(session);
        }
      });

      // Generate schedule-based days
      while (scheduleDaysFound < limitCount && enabledDays.length > 0) {
        const currentDayIndex = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Check if current day matches any enabled day
        const matchingDay = enabledDays.find(day => day.dayIndex === currentDayIndex);

        if (matchingDay) {
          const dateKey = currentDate.toISOString().split('T')[0];

          // Check if we already have sessions for this date
          const existingDaySessions = sessionDays.get(dateKey)?.sessions || [];

          // Get the program for this day if assigned
          let program = null;
          if (matchingDay.programId && matchingDay.programId !== 'none') {
            try {
              const programs = await this.getTrainingPrograms(clubId);
              program = programs.find(p => p.id === matchingDay.programId);
            } catch (error) {
              console.error('❌ Error fetching program for day:', error);
            }
          }

          // Create day object
          const dayObj = {
            id: dateKey,
            date: new Date(currentDate),
            dayName: currentDate.toLocaleDateString('en-US', { weekday: 'long' }),
            dateString: currentDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }),
            startTime: matchingDay.startTime,
            endTime: matchingDay.endTime,
            program: program,
            programId: matchingDay.programId,
            sessions: existingDaySessions
          };

          days.push(dayObj);
          scheduleDaysFound++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Add days with only manually assigned sessions (not from weekly schedule)
      for (const [dateKey, dayInfo] of sessionDays) {
        // Check if we already added this day from the schedule
        const existingDay = days.find(d => d.id === dateKey);

        if (!existingDay && dayInfo.sessions.length > 0) {
          const sessionDate = dayInfo.sessions[0].date;
          const dayObj = {
            id: dateKey,
            date: sessionDate,
            dayName: sessionDate.toLocaleDateString('en-US', { weekday: 'long' }),
            dateString: sessionDate.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }),
            startTime: '09:00', // Default times for manually assigned sessions
            endTime: '10:30',
            program: null, // Will be set from session data
            programId: null,
            sessions: dayInfo.sessions
          };

          // If there's a session with program info, use it
          const sessionWithProgram = dayInfo.sessions.find(s => s.programId);
          if (sessionWithProgram) {
            try {
              const programs = await this.getTrainingPrograms(clubId);
              const program = programs.find(p => p.id === sessionWithProgram.programId);
              if (program) {
                dayObj.program = program;
                dayObj.programId = program.id;
                dayObj.startTime = sessionWithProgram.startTime || dayObj.startTime;
                dayObj.endTime = sessionWithProgram.endTime || dayObj.endTime;
              }
            } catch (error) {
              console.error('Error fetching program for session:', error);
            }
          }

          days.push(dayObj);
        }
      }

      // Sort days by date and limit
      days.sort((a, b) => a.date - b.date);
      return days.slice(0, limitCount);

    } catch (error) {
      console.error('❌ Error fetching upcoming training days:', error);
      throw error;
    }
  },

  _getDayIndex(dayKey) {
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6
    };
    return dayMap[dayKey];
  },

  async getTrainingPrograms(clubId) {
    try {
      const programsQuery = query(
        collection(db, 'trainingPrograms'),
        where('clubId', '==', clubId),
        where('isActive', '==', true)
      );

      const programsSnap = await getDocs(programsQuery);
      return programsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching training programs:', error);
      throw error;
    }
  },

  async updateTrainingProgram(programId, programData) {
    try {
      const programRef = doc(db, 'trainingPrograms', programId);
      const updatedData = {
        ...programData,
        updatedAt: new Date()
      };

      await updateDoc(programRef, updatedData);
      // console.log removed('✅ Training program updated successfully:', programData.name);
      return updatedData;
    } catch (error) {
      console.error('❌ Error updating training program:', error);
      throw error;
    }
  },

  async deleteTrainingProgram(programId) {
    try {
      const programRef = doc(db, 'trainingPrograms', programId);
      await updateDoc(programRef, {
        isActive: false,
        updatedAt: new Date()
      });
      // console.log removed('✅ Training program deactivated successfully');
    } catch (error) {
      console.error('❌ Error deleting training program:', error);
      throw error;
    }
  },

  // Training Session Management
  async createTrainingSession(sessionData) {
    try {
      const sessionRef = doc(collection(db, 'trainingSessions'));
      const session = {
        id: sessionRef.id,
        clubId: sessionData.clubId,
        programId: sessionData.programId,
        title: sessionData.title,
        description: sessionData.description || '',
        date: sessionData.date,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        location: sessionData.location || '',
        coachId: sessionData.coachId,
        maxParticipants: sessionData.maxParticipants || null,
        createdAt: new Date(),
        status: 'scheduled' // scheduled, completed, cancelled
      };

      await setDoc(sessionRef, session);
      return session;
    } catch (error) {
      console.error('Error creating training session:', error);
      throw error;
    }
  },

  async getUpcomingTrainingSessions(clubId, limitCount = 10) {
    try {
      // For now, simplify the query to avoid index requirements
      // Get all sessions and filter client-side
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        orderBy('date', 'asc')
      );

      const sessionsSnap = await getDocs(sessionsQuery);
      const now = new Date();

      // Filter and limit client-side
      const upcomingSessions = sessionsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(session => session.date.toDate() >= now && session.status === 'scheduled')
        .slice(0, limitCount);

      return upcomingSessions;
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      throw error;
    }
  },

  async getTrainingSessionsForDate(clubId, date) {
    try {
      // Get all sessions for the club and filter by date client-side
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        orderBy('date', 'asc')
      );

      const sessionsSnap = await getDocs(sessionsQuery);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Filter by date range client-side
      const sessionsForDate = sessionsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(session => {
          const sessionDate = session.date.toDate();
          return sessionDate >= startOfDay && sessionDate <= endOfDay;
        });

      return sessionsForDate;
    } catch (error) {
      console.error('Error fetching training sessions for date:', error);
      throw error;
    }
  },

  // Training Session from Weekly Schedule
  async createTrainingSessionFromSchedule(clubId, dayData, program) {
    try {
      const sessionRef = doc(collection(db, 'trainingSessions'));
      const sessionDate = new Date(dayData.date);

      // Create session data
      const session = {
        id: sessionRef.id,
        clubId,
        programId: program.id,
        programName: program.name,
        title: `${program.name} - ${dayData.dayName}`,
        description: program.description || '',
        date: sessionDate,
        startTime: dayData.startTime,
        endTime: dayData.endTime,
        location: '', // Could be added later
        coachId: null, // Will be set when coach marks attendance
        maxParticipants: null,
        createdAt: new Date(),
        status: 'scheduled', // scheduled, completed, cancelled
        isFromSchedule: true // Mark as auto-created from schedule
      };

      await setDoc(sessionRef, session);
      // console.log removed('✅ Training session created from schedule:', session.title);
      return session;
    } catch (error) {
      console.error('❌ Error creating training session from schedule:', error);
      throw error;
    }
  },

  async getOrCreateTrainingSessionForDate(clubId, date, program) {
    try {
      // First try to find existing session for this date
      const existingSession = await this.getTrainingSessionsForDate(clubId, date);

      // If session exists, return it
      if (existingSession.length > 0) {
        return existingSession[0];
      }

      // If no session exists, create one from the schedule
      const dayData = {
        date: date,
        dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'long' }),
        startTime: program.startTime || '09:00',
        endTime: program.endTime || '10:30'
      };

      return await this.createTrainingSessionFromSchedule(clubId, dayData, program);
    } catch (error) {
      console.error('❌ Error getting or creating training session:', error);
      throw error;
    }
  },

  // Attendance Management
  async markAttendance(sessionId, athleteId, status, coachId, notes = '') {
    try {
      const attendanceRef = doc(db, 'trainingSessions', sessionId, 'attendance', athleteId);
      const attendanceData = {
        athleteId,
        sessionId,
        status, // 'present', 'absent', 'late', 'excused'
        markedBy: coachId,
        markedAt: new Date(),
        notes: notes
      };

      await setDoc(attendanceRef, attendanceData);
      return attendanceData;
    } catch (error) {
      console.error('Error marking attendance:', error);
      throw error;
    }
  },

  async bulkMarkAttendance(sessionId, attendanceData, coachId) {
    try {
      const batch = writeBatch(db);

      attendanceData.forEach(({ athleteId, status, notes = '' }) => {
        const attendanceRef = doc(db, 'trainingSessions', sessionId, 'attendance', athleteId);
        const data = {
          athleteId,
          sessionId,
          status,
          markedBy: coachId,
          markedAt: new Date(),
          notes
        };
        batch.set(attendanceRef, data);
      });

      await batch.commit();
      // console.log removed('✅ Bulk attendance marked for', attendanceData.length, 'athletes');
      return true;
    } catch (error) {
      console.error('❌ Error bulk marking attendance:', error);
      throw error;
    }
  },

  async getSessionAttendance(sessionId) {
    try {
      const attendanceQuery = collection(db, 'trainingSessions', sessionId, 'attendance');
      const attendanceSnap = await getDocs(attendanceQuery);
      return attendanceSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error('Error fetching session attendance:', error);
      throw error;
    }
  },

  async getAthleteAttendance(athleteId, clubId, limitCount = 30) {
    try {
      // Get all sessions for the club (simplified to avoid index requirements)
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        orderBy('date', 'desc')
      );

      const sessionsSnap = await getDocs(sessionsQuery);
      const sessions = sessionsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(session => session.status === 'completed')
        .slice(0, limitCount);

      // For each session, get the athlete's attendance
      const attendancePromises = sessions.map(async (session) => {
        try {
          const attendanceRef = doc(db, 'trainingSessions', session.id, 'attendance', athleteId);
          const attendanceSnap = await getDoc(attendanceRef);

          if (attendanceSnap.exists()) {
            return {
              session: session,
              attendance: { id: attendanceSnap.id, ...attendanceSnap.data() }
            };
          } else {
            return {
              session: session,
              attendance: null // No attendance record
            };
          }
        } catch (error) {
          console.error(`Error fetching attendance for session ${session.id}:`, error);
          return {
            session: session,
            attendance: null
          };
        }
      });

      const attendanceRecords = await Promise.all(attendancePromises);
      return attendanceRecords;
    } catch (error) {
      console.error('Error fetching athlete attendance:', error);
      throw error;
    }
  },

  // Athlete Statistics
  async getAthleteStats(athleteId, clubId) {
    try {
      const attendanceRecords = await this.getAthleteAttendance(athleteId, clubId);

      let totalSessions = attendanceRecords.length;
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      attendanceRecords.forEach(record => {
        if (record.attendance) {
          switch (record.attendance.status) {
            case 'present':
              presentCount++;
              break;
            case 'absent':
              absentCount++;
              break;
            case 'late':
              lateCount++;
              break;
          }
        } else {
          absentCount++; // No attendance record means absent
        }
      });

      const attendanceRate = totalSessions > 0 ? ((presentCount + lateCount) / totalSessions) * 100 : 0;

      return {
        totalSessions,
        presentCount,
        absentCount,
        lateCount,
        attendanceRate: Math.round(attendanceRate * 100) / 100,
        recentAttendance: attendanceRecords.slice(0, 10) // Last 10 sessions
      };
    } catch (error) {
      console.error('Error fetching athlete stats:', error);
      throw error;
    }
  },

  // Super Admin Management Functions
  async promoteToSuperAdmin(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Update user profile to super admin
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'super',
        updatedAt: new Date().toISOString()
      });

      // console.log removed(`✅ User ${userId} promoted to super admin`);
      return { success: true, message: `User promoted to super admin successfully` };
    } catch (error) {
      console.error('Error promoting user to super admin:', error);
      throw new Error(`Failed to promote user to super admin: ${error.message}`);
    }
  },

  async demoteFromSuperAdmin(userId) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      // Update user profile to remove super admin role
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        role: 'athlete', // or 'pending' depending on your needs
        updatedAt: new Date().toISOString()
      });

      // console.log removed(`✅ User ${userId} demoted from super admin`);
      return { success: true, message: `User demoted from super admin successfully` };
    } catch (error) {
      console.error('Error demoting user from super admin:', error);
      throw new Error(`Failed to demote user from super admin: ${error.message}`);
    }
  },

  async getUserByEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error(`No user found with email: ${email}`);
      }

      const userDoc = querySnapshot.docs[0];
      return {
        id: userDoc.id,
        ...userDoc.data()
      };
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error(`Failed to find user: ${error.message}`);
    }
  },

  async promoteUserByEmail(email) {
    if (!email) {
      throw new Error('Email is required');
    }

    try {
      const user = await this.getUserByEmail(email);
      return await this.promoteToSuperAdmin(user.id);
    } catch (error) {
      console.error('Error promoting user by email:', error);
      throw error;
    }
  },

  // Vacation/Cancellation Management
  async saveTrainingCancellations(clubId, cancellations, userId) {
    try {
      const cancellationsRef = doc(db, 'clubs', clubId, 'settings', 'cancellations');
      const data = {
        clubId,
        cancellations, // Array of { date: Date, reason: string, type: 'vacation' | 'maintenance' | 'other' }
        updatedAt: new Date(),
        updatedBy: userId
      };

      await setDoc(cancellationsRef, data);
      // console.log removed('✅ Training cancellations saved successfully');
      return data;
    } catch (error) {
      console.error('❌ Error saving training cancellations:', error);
      throw error;
    }
  },

  async getTrainingCancellations(clubId) {
    try {
      const cancellationsRef = doc(db, 'clubs', clubId, 'settings', 'cancellations');
      const cancellationsSnap = await getDoc(cancellationsRef);

      if (cancellationsSnap.exists()) {
        return cancellationsSnap.data();
      } else {
        return {
          clubId,
          cancellations: [],
          updatedAt: null,
          updatedBy: null
        };
      }
    } catch (error) {
      console.error('❌ Error fetching training cancellations:', error);
      throw error;
    }
  },

  async addTrainingCancellation(clubId, cancellationData, userId) {
    try {
      const currentCancellations = await this.getTrainingCancellations(clubId);
      const newCancellations = [...currentCancellations.cancellations, {
        id: `cancellation_${Date.now()}`,
        date: cancellationData.date,
        reason: cancellationData.reason,
        type: cancellationData.type || 'other',
        createdAt: new Date(),
        createdBy: userId
      }];

      return await this.saveTrainingCancellations(clubId, newCancellations, userId);
    } catch (error) {
      console.error('❌ Error adding training cancellation:', error);
      throw error;
    }
  },

  async removeTrainingCancellation(clubId, cancellationId, userId) {
    try {
      const currentCancellations = await this.getTrainingCancellations(clubId);
      const filteredCancellations = currentCancellations.cancellations.filter(
        c => c.id !== cancellationId
      );

      return await this.saveTrainingCancellations(clubId, filteredCancellations, userId);
    } catch (error) {
      console.error('❌ Error removing training cancellation:', error);
      throw error;
    }
  },

  // Enhanced attendance management for editing past sessions
  async getTrainingSessionsInRange(clubId, startDate, endDate) {
    try {
      const sessionsQuery = query(
        collection(db, 'trainingSessions'),
        where('clubId', '==', clubId),
        orderBy('date', 'asc')
      );

      const sessionsSnap = await getDocs(sessionsQuery);
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const sessionsInRange = sessionsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(session => {
          const sessionDate = session.date.toDate();
          return sessionDate >= start && sessionDate <= end;
        });

      return sessionsInRange;
    } catch (error) {
      console.error('Error fetching training sessions in range:', error);
      throw error;
    }
  },

  async updateSessionAttendance(sessionId, attendanceUpdates, userId) {
    try {
      const batch = writeBatch(db);

      attendanceUpdates.forEach(({ athleteId, status, notes = '' }) => {
        const attendanceRef = doc(db, 'trainingSessions', sessionId, 'attendance', athleteId);
        const data = {
          athleteId,
          sessionId,
          status,
          markedBy: userId,
          markedAt: new Date(),
          notes,
          lastUpdated: new Date(),
          updatedBy: userId
        };
        batch.set(attendanceRef, data, { merge: true });
      });

      await batch.commit();
      // console.log removed('✅ Session attendance updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating session attendance:', error);
      throw error;
    }
  },

  // Calendar view helpers
  async getMonthlyTrainingCalendar(clubId, year, month) {
    try {
      // Get the first day of the month and last day
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 0);
      
      // Get weekly schedule
      const weeklySchedule = await this.getWeeklySchedule(clubId);
      
      // Get cancellations
      const cancellations = await this.getTrainingCancellations(clubId);
      
      // Get actual training sessions
      const sessions = await this.getTrainingSessionsInRange(clubId, startDate, endDate);
      
      // Build calendar data
      const calendarData = [];
      const currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dayOfWeek = this._getDayKeyFromIndex(currentDate.getDay());
        const scheduleForDay = weeklySchedule.schedule?.[dayOfWeek];
        
        // Check if day is cancelled
        const isCancelled = cancellations.cancellations?.some(c => {
          let cancellationDate;
          
          // Handle Firestore Timestamp
          if (c.date && c.date.toDate && typeof c.date.toDate === 'function') {
            cancellationDate = c.date.toDate();
          } 
          // Handle regular Date object
          else if (c.date instanceof Date) {
            cancellationDate = c.date;
          } 
          // Handle date strings/numbers
          else {
            cancellationDate = new Date(c.date);
          }
          
          // Only compare if we have a valid date
          if (cancellationDate && !isNaN(cancellationDate.getTime())) {
            return cancellationDate.toDateString() === currentDate.toDateString();
          }
          return false;
        });
        
        // Find actual session for this date
        const session = sessions.find(s => {
          const sessionDate = s.date.toDate();
          return sessionDate.toDateString() === currentDate.toDateString();
        });
        
        calendarData.push({
          date: new Date(currentDate),
          dayOfWeek,
          isScheduled: scheduleForDay?.enabled || false,
          isCancelled,
          session,
          scheduleInfo: scheduleForDay,
          cancellationInfo: isCancelled ? cancellations.cancellations.find(c => {
            let cancellationDate;
            
            // Handle Firestore Timestamp
            if (c.date && c.date.toDate && typeof c.date.toDate === 'function') {
              cancellationDate = c.date.toDate();
            } 
            // Handle regular Date object
            else if (c.date instanceof Date) {
              cancellationDate = c.date;
            } 
            // Handle date strings/numbers
            else {
              cancellationDate = new Date(c.date);
            }
            
            // Only compare if we have a valid date
            if (cancellationDate && !isNaN(cancellationDate.getTime())) {
              return cancellationDate.toDateString() === currentDate.toDateString();
            }
            return false;
          }) : null
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      return calendarData;
    } catch (error) {
      console.error('❌ Error fetching monthly training calendar:', error);
      throw error;
    }
  },

  _getDayKeyFromIndex(dayIndex) {
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return dayKeys[dayIndex];
  },

  // Pending Invitations Management
  async getPendingInvitations(clubId) {
    try {
      const pendingRef = collection(db, 'clubs', clubId, 'pendingAssignments');
      const snapshot = await getDocs(pendingRef);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().assignedAt // Use assignedAt as createdAt for consistency
      }));
    } catch (error) {
      console.error('Error fetching pending invitations:', error);
      throw error;
    }
  },

  async cancelInvitation(clubId, email) {
    try {
      // pendingAssignments uses email with dots replaced by underscores as doc ID
      const docId = email.replace(/\./g, '_');
      const pendingRef = doc(db, 'clubs', clubId, 'pendingAssignments', docId);
      await deleteDoc(pendingRef);
      // console.log removed('✅ Invitation cancelled for:', email);
      return true;
    } catch (error) {
      console.error('Error cancelling invitation:', error);
      throw error;
    }
  },

  // Updated method to handle invitation cancellation by document ID
  async cancelInvitationById(invitationId, clubId) {
    try {
      const pendingRef = doc(db, 'clubs', clubId, 'pendingAssignments', invitationId);
      await deleteDoc(pendingRef);
      // console.log removed('✅ Invitation cancelled:', invitationId);
      return true;
    } catch (error) {
      console.error('Error cancelling invitation by ID:', error);
      throw error;
    }
  },

  // ==================== CLUB MESSAGES ====================

  async saveClubMessage(clubId, messageData) {
    try {
      const messageRef = doc(db, 'clubs', clubId, 'messages', 'current');
      const messageToSave = {
        ...messageData,
        updatedAt: new Date(),
        active: true
      };
      
      await setDoc(messageRef, messageToSave);
      // console.log removed('✅ Club message saved successfully');
      return messageToSave;
    } catch (error) {
      console.error('❌ Error saving club message:', error);
      throw error;
    }
  },

  async getClubMessage(clubId) {
    try {
      const messageRef = doc(db, 'clubs', clubId, 'messages', 'current');
      const messageSnap = await getDoc(messageRef);
      
      if (messageSnap.exists()) {
        const messageData = messageSnap.data();
        // Only return active messages
        return messageData.active ? messageData : null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting club message:', error);
      throw error;
    }
  },

  async deleteClubMessage(clubId) {
    try {
      const messageRef = doc(db, 'clubs', clubId, 'messages', 'current');
      await updateDoc(messageRef, {
        active: false,
        deletedAt: new Date()
      });
      // console.log removed('✅ Club message deleted successfully');
    } catch (error) {
      console.error('❌ Error deleting club message:', error);
      throw error;
    }
  }
};


