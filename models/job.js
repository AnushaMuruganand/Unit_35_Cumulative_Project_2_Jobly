"use strict";

const db = require("../db");
const { NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, companyHandle }
   *
   * Returns { id, title, salary, equity, companyHandle }
   **/

  static async create({ title, salary, equity, companyHandle }) {

    const result = await db.query(
          `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4)
           RETURNING title, salary, equity, company_handle AS "companyHandle"`,
        [
            title, salary, equity, companyHandle
        ],
    );
    const job= result.rows[0];

    return job;
  }

 /** Find all jobs (optional filter on searchFilters).
   *
   * searchFilters (all optional):
   * - minSalary
   * - hasEquity (true returns only jobs with equity > 0, other values ignored)
   * - title (will find case-insensitive, partial matches)
   *
   * Returns [{ id, title, salary, equity, companyHandle, companyName }, ...]
   * */

  static async findAll(searchFilters = {}) {

    let { minSalary, hasEquity, title } = searchFilters;

    let queryValues = [];
    let whereClauses = [];

      let query = `SELECT j.id,
                    j.title, j.salary, j.equity,
                    j.company_handle AS "companyHandle",
                    c.name AS "companyName"
                    FROM jobs AS j LEFT JOIN companies AS c ON j.company_handle = c.handle`;

    // For each possible search term, add to whereExpressions and queryValues so
    // we can generate the right SQL
    if (minSalary) {
      queryValues.push(minSalary);
      whereClauses.push(`j.salary >= $${queryValues.length}`);
    }
    
    if (hasEquity === true) {
        whereClauses.push(`j.equity > 0`);
    }

    if (title) {
      queryValues.push(`%${title}%`);
      whereClauses.push(`title ILIKE $${queryValues.length}`);
    }

    if (whereClauses.length > 0) {
      query += " WHERE " + whereClauses.join(" AND ");
    }

    query += " ORDER BY j.title";
      
    const jobsRes = await db.query(query, queryValues);

    return jobsRes.rows;
  }

  /** Given a job id, return data about job.
   *
   * Returns { id, title, salary, equity, companyHandle, company }
   *   where company is { handle, name, description, numEmployees, logoUrl }
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const jobRes = await db.query(
          `SELECT id,
            title, salary, equity,
            company_handle AS "companyHandle"
            FROM jobs
            WHERE id = $1`,
            [id]);

    const job = jobRes.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
      
    // Selecting the company based on the company_handle in "jobRes"
    
    const companyRes = await db.query(
          `SELECT handle,
            name, num_employees AS "numEmployees",
            description, logo_url AS "logoUrl"
            FROM companies
            WHERE handle = $1`,
          [job.companyHandle]);
    
    delete job.companyHandle;
    job.company = companyRes.rows[0];
    
    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain
   * all the fields; this only changes provided ones.
   *
   * Data can include: { title, salary, equity }
   *
   * Returns { id, title, salary, equity, companyHandle }
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {});
    
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id, 
                                title, 
                                salary, 
                                equity, 
                                company_handle AS "companyHandle"`;
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);

    return job;
  }

  /** Delete given job from database; returns undefined.
   *
   * Throws NotFoundError if job not found.
   **/

  static async remove(id) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
        [id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }
}


module.exports = Job;
